import { Router } from 'express';
import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { getModels } from '../models/index.js';
import { iLike } from '../utils/dbCompat.js';
import { Role } from '../models/enums.js';

const router = Router();

// ==================== DASHBOARD ====================

router.get('/dashboard', authenticate, requireAdmin, async (req, res) => {
  const { Ticket, User, TopicGroup } = getModels();

  const [totalTickets, openTickets, inProgressTickets, resolvedTickets, totalUsers, totalAgents, totalGroups] = await Promise.all([
    Ticket.count(),
    Ticket.count({ where: { status: 'OPEN' } }),
    Ticket.count({ where: { status: 'IN_PROGRESS' } }),
    Ticket.count({ where: { status: 'RESOLVED' } }),
    User.count(),
    User.count({ where: { role: { [Op.in]: ['AGENT', 'ADMIN'] } } }),
    TopicGroup.count()
  ]);

  const recentTickets = await Ticket.findAll({
    include: [{ model: User, as: 'author', attributes: ['id', 'displayName'] }],
    order: [['createdAt', 'DESC']],
    limit: 10,
    attributes: ['id', 'number', 'title', 'status', 'priority', 'createdAt']
  });

  res.json({
    data: {
      stats: { totalTickets, openTickets, inProgressTickets, resolvedTickets, totalUsers, totalAgents, totalGroups },
      recentTickets
    }
  });
});

// ==================== USERS ====================

router.get('/users', authenticate, async (req, res) => {
  const { page = 1, limit = 20, role, search, active } = req.query;
  const { User } = getModels();

  const where = {};
  if (role) where.role = role;
  if (active !== undefined) where.isActive = active === 'true';
  if (search) {
    where[Op.or] = [
      { login: iLike(`%${search}%`) },
      { displayName: iLike(`%${search}%`) },
      { email: iLike(`%${search}%`) }
    ];
  }

  // Для агентов — только список агентов (для делегирования)
  if (req.user.role !== 'ADMIN') {
    where.role = { [Op.in]: ['AGENT', 'ADMIN'] };
    where.isActive = true;
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: ['id', 'login', 'email', 'displayName', 'role', 'isRootAdmin', 'authProvider', 'isActive', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset
  });

  res.json({
    data: rows.map(u => u.toJSON()),
    pagination: { page: parseInt(page), limit: parseInt(limit), total: count, totalPages: Math.ceil(count / parseInt(limit)) }
  });
});

router.post('/users', authenticate, requireAdmin, async (req, res) => {
  const { login, email, password, displayName, role = 'USER' } = req.body;
  const { User } = getModels();

  if (!login || !password || !displayName) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Заполните логин, пароль и имя' } });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await User.create({
      login, email: email || null, passwordHash, displayName,
      role: Object.values(Role).includes(role) ? role : Role.USER
    });

    res.status(201).json({ data: { id: user.id, login: user.login, displayName: user.displayName, role: user.role } });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Пользователь уже существует' } });
    }
    throw err;
  }
});

router.put('/users/:id', authenticate, requireAdmin, async (req, res) => {
  const { User } = getModels();
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Пользователь не найден' } });

  const { displayName, email } = req.body;
  if (displayName) user.displayName = displayName;
  if (email !== undefined) user.email = email;

  await user.save();
  res.json({ data: user.toJSON() });
});

router.put('/users/:id/role', authenticate, requireAdmin, async (req, res) => {
  const { role } = req.body;
  const { User } = getModels();

  if (!Object.values(Role).includes(role)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Невалидная роль' } });
  }

  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Пользователь не найден' } });

  user.role = role;
  await user.save();

  res.json({ data: { id: user.id, role: user.role } });
});

router.put('/users/:id/active', authenticate, requireAdmin, async (req, res) => {
  const { isActive } = req.body;
  const { User } = getModels();

  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Пользователь не найден' } });

  user.isActive = !!isActive;
  await user.save();

  res.json({ data: { id: user.id, isActive: user.isActive } });
});

router.delete('/users/:id', authenticate, requireAdmin, async (req, res) => {
  const { User } = getModels();
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Пользователь не найден' } });

  if (user.isRootAdmin) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Нельзя удалить корневого администратора' } });
  }

  // Soft delete — деактивация
  user.isActive = false;
  await user.save();
  res.status(204).send();
});

// ==================== SETTINGS ====================

router.get('/settings', authenticate, requireAdmin, async (req, res) => {
  const { SystemSettings } = getModels();
  const settings = await SystemSettings.findAll();

  const result = {};
  for (const s of settings) {
    result[s.key] = s.value;
  }

  res.json({ data: result });
});

router.put('/settings/:key', authenticate, requireAdmin, async (req, res) => {
  const { value } = req.body;
  const { SystemSettings } = getModels();

  const [setting] = await SystemSettings.findOrCreate({
    where: { key: req.params.key },
    defaults: { value }
  });

  if (setting.value !== value) {
    await setting.update({ value });
  }

  res.json({ data: { key: req.params.key, value } });
});

// ==================== AUTH PROVIDERS ====================

router.get('/auth-providers', authenticate, requireAdmin, async (req, res) => {
  const { AuthProvider } = getModels();
  const providers = await AuthProvider.findAll({ order: [['createdAt', 'ASC']] });
  res.json({ data: providers });
});

router.post('/auth-providers', authenticate, requireAdmin, async (req, res) => {
  const { type, name, config, isActive } = req.body;
  const { AuthProvider } = getModels();

  if (!type || !name) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Укажите тип и имя провайдера' } });
  }

  const provider = await AuthProvider.create({
    type, name, config: config || {}, isActive: isActive !== false
  });

  res.status(201).json({ data: provider });
});

router.put('/auth-providers/:id', authenticate, requireAdmin, async (req, res) => {
  const { AuthProvider } = getModels();
  const provider = await AuthProvider.findByPk(req.params.id);
  if (!provider) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Провайдер не найден' } });

  const { name, config, isActive } = req.body;
  if (name) provider.name = name;
  if (config) provider.config = config;
  if (isActive !== undefined) provider.isActive = isActive;

  await provider.save();
  res.json({ data: provider });
});

router.delete('/auth-providers/:id', authenticate, requireAdmin, async (req, res) => {
  const { AuthProvider } = getModels();
  const provider = await AuthProvider.findByPk(req.params.id);
  if (!provider) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Провайдер не найден' } });

  await provider.destroy();
  res.status(204).send();
});

router.post('/auth-providers/:id/test', authenticate, requireAdmin, async (req, res) => {
  const { AuthProvider } = getModels();
  const provider = await AuthProvider.findByPk(req.params.id);
  if (!provider) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Провайдер не найден' } });

  if (provider.type === 'ONE_C') {
    const config = provider.config || {};
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeout || 5000);
      const testRes = await fetch(`${config.baseUrl}${config.authEndpoint || '/auth/validate'}`, {
        method: 'HEAD', signal: controller.signal
      });
      clearTimeout(timer);
      res.json({ data: { success: true, status: testRes.status, message: 'Сервер 1С доступен' } });
    } catch (err) {
      res.json({ data: { success: false, message: `Недоступен: ${err.message}` } });
    }
  } else {
    res.json({ data: { success: true, message: 'Локальный провайдер всегда активен' } });
  }
});

// ==================== SMTP ====================

router.post('/smtp/test', authenticate, requireAdmin, async (req, res) => {
  try {
    const { testSmtp } = await import('../services/email.js');
    await testSmtp();
    res.json({ data: { success: true, message: 'SMTP соединение успешно' } });
  } catch (err) {
    res.json({ data: { success: false, message: err.message } });
  }
});

router.post('/smtp/reload', authenticate, requireAdmin, async (req, res) => {
  const { reloadSmtp } = await import('../services/email.js');
  await reloadSmtp();
  res.json({ data: { success: true } });
});

// ==================== CUSTOM FIELDS ====================

router.get('/custom-fields', authenticate, requireAdmin, async (req, res) => {
  const { CustomField } = getModels();
  const fields = await CustomField.findAll({ order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']] });
  res.json({ data: fields });
});

router.post('/custom-fields', authenticate, requireAdmin, async (req, res) => {
  const { name, fieldKey, type = 'text', required = false, defaultValue, options, isActive = true } = req.body;
  const { CustomField } = getModels();

  if (!name || !fieldKey) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Укажите название и ключ поля' } });
  }

  // Валидация ключа: только латиница, цифры, подчёркивания
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fieldKey)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Ключ поля может содержать только латиницу, цифры и подчёркивания' } });
  }

  // Определяем sortOrder — последний + 1
  const maxOrder = await CustomField.max('sortOrder') || 0;

  try {
    const field = await CustomField.create({
      name, fieldKey, type, required, defaultValue: defaultValue || null,
      options: options || null, sortOrder: maxOrder + 1, isActive
    });
    res.status(201).json({ data: field });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Поле с таким ключом уже существует' } });
    }
    throw err;
  }
});

router.put('/custom-fields/:id', authenticate, requireAdmin, async (req, res) => {
  const { CustomField } = getModels();
  const field = await CustomField.findByPk(req.params.id);
  if (!field) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Поле не найдено' } });

  const { name, type, required, defaultValue, options, isActive } = req.body;
  if (name !== undefined) field.name = name;
  if (type !== undefined) field.type = type;
  if (required !== undefined) field.required = required;
  if (defaultValue !== undefined) field.defaultValue = defaultValue;
  if (options !== undefined) field.options = options;
  if (isActive !== undefined) field.isActive = isActive;

  await field.save();
  res.json({ data: field });
});

router.delete('/custom-fields/:id', authenticate, requireAdmin, async (req, res) => {
  const { CustomField } = getModels();
  const field = await CustomField.findByPk(req.params.id);
  if (!field) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Поле не найдено' } });

  await field.destroy();
  res.status(204).send();
});

router.put('/custom-fields-reorder', authenticate, requireAdmin, async (req, res) => {
  const { order } = req.body; // [{id, sortOrder}, ...]
  const { CustomField } = getModels();

  if (!Array.isArray(order)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Ожидается массив order' } });
  }

  for (const item of order) {
    await CustomField.update({ sortOrder: item.sortOrder }, { where: { id: item.id } });
  }

  const fields = await CustomField.findAll({ order: [['sortOrder', 'ASC']] });
  res.json({ data: fields });
});

export default router;
