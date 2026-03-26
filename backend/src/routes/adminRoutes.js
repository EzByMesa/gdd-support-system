import { Router } from 'express';
import { Op, literal } from 'sequelize';
import bcrypt from 'bcryptjs';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { getModels } from '../models/index.js';
import { iLike } from '../utils/dbCompat.js';
import { Role } from '../models/enums.js';
import { sendToUser } from '../websocket/wsServer.js';

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

  // WS: уведомить пользователя об обновлении профиля
  sendToUser(user.id, { type: 'profile_updated' });
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

  // WS: уведомить пользователя — его роль изменилась (перезагрузить страницу)
  sendToUser(user.id, { type: 'profile_updated' });
});

router.put('/users/:id/active', authenticate, requireAdmin, async (req, res) => {
  const { isActive } = req.body;
  const { User } = getModels();

  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Пользователь не найден' } });

  user.isActive = !!isActive;
  await user.save();

  res.json({ data: { id: user.id, isActive: user.isActive } });

  // WS: если деактивирован — принудительный logout
  if (!user.isActive) sendToUser(user.id, { type: 'force_logout' });
});

router.delete('/users/:id', authenticate, requireAdmin, async (req, res) => {
  const { User, Ticket, TicketMessage, Notification, PushSubscription, NotificationPreference,
    EmailVerification, AgentAlias, Attachment, DelegationRequest, TicketReadStatus, KnowledgeArticle } = getModels();
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Пользователь не найден' } });

  if (user.isRootAdmin) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Нельзя удалить корневого администратора' } });
  }

  if (user.id === req.user.sub) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Нельзя удалить самого себя' } });
  }

  console.log(`[Admin] Удаление пользователя "${user.displayName}" (@${user.login}), id=${user.id}`);

  // Удаляем все связанные данные
  await Notification.destroy({ where: { userId: user.id } }).catch(() => {});
  await PushSubscription.destroy({ where: { userId: user.id } }).catch(() => {});
  await NotificationPreference.destroy({ where: { userId: user.id } }).catch(() => {});
  await EmailVerification.destroy({ where: { userId: user.id } }).catch(() => {});
  await AgentAlias.destroy({ where: { agentId: user.id } }).catch(() => {});
  await TicketReadStatus.destroy({ where: { userId: user.id } }).catch(() => {});
  await DelegationRequest.destroy({ where: { fromAgentId: user.id } }).catch(() => {});
  await DelegationRequest.destroy({ where: { toAgentId: user.id } }).catch(() => {});

  // Обнуляем ВСЕ FK-ссылки (не удаляем тикеты/сообщения/вложения)
  await Ticket.update({ authorId: null }, { where: { authorId: user.id } }).catch(() => {});
  await Ticket.update({ assigneeId: null }, { where: { assigneeId: user.id } }).catch(() => {});
  await Ticket.update({ createdById: null }, { where: { createdById: user.id } }).catch(() => {});
  await TicketMessage.update({ authorId: null }, { where: { authorId: user.id } }).catch(() => {});
  await Attachment.update({ uploadedById: null }, { where: { uploadedById: user.id } }).catch(() => {});
  await KnowledgeArticle.update({ authorId: null }, { where: { authorId: user.id } }).catch(() => {});

  sendToUser(user.id, { type: 'force_logout' });

  // Удаляем пользователя
  try {
    await user.destroy();
    res.status(204).send();
  } catch (err) {
    console.error(`[Admin] Ошибка удаления пользователя: ${err.message}`);
    res.status(500).json({ error: { code: 'DELETE_FAILED', message: `Не удалось удалить: ${err.message}` } });
  }
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

// ==================== TICKETS ====================

router.delete('/tickets/:id', authenticate, requireAdmin, async (req, res) => {
  const { Ticket, TicketMessage, Attachment, AgentAlias, DelegationRequest, Notification } = getModels();
  const ticket = await Ticket.findByPk(req.params.id);
  if (!ticket) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Тикет не найден' } });

  console.log(`[Admin] Удаление тикета #${ticket.number} "${ticket.title}" (${ticket.id})`);

  // Удаляем связанные уведомления
  await Notification.destroy({
    where: {
      [Op.or]: [
        literal(`"data"->>'ticketId' = '${ticket.id}'`),
        literal(`json_extract("data", '$.ticketId') = '${ticket.id}'`)
      ]
    }
  }).catch(() => {});
  await DelegationRequest.destroy({ where: { ticketId: ticket.id } });
  await AgentAlias.destroy({ where: { ticketId: ticket.id } });
  await Attachment.destroy({ where: { ticketId: ticket.id } });
  await TicketMessage.destroy({ where: { ticketId: ticket.id } });
  // WS: обновить списки у автора и assignee
  if (ticket.authorId) sendToUser(ticket.authorId, { type: 'tickets_updated' });
  if (ticket.assigneeId) sendToUser(ticket.assigneeId, { type: 'tickets_updated' });

  await ticket.destroy();

  res.status(204).send();
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

  console.log(`[Provider] Создание провайдера: type=${type}, name="${name}", isActive=${isActive !== false}`);
  if (config) {
    console.log(`[Provider]   baseUrl: ${config.baseUrl || '(не задан)'}`);
    console.log(`[Provider]   authEndpoint: ${config.authEndpoint || '/auth/validate'}`);
    console.log(`[Provider]   timeout: ${config.timeout || 5000}ms`);
  }

  const provider = await AuthProvider.create({
    type, name, config: config || {}, isActive: isActive !== false
  });

  console.log(`[Provider] Провайдер создан: id=${provider.id}`);
  res.status(201).json({ data: provider });
});

router.put('/auth-providers/:id', authenticate, requireAdmin, async (req, res) => {
  const { AuthProvider } = getModels();
  const provider = await AuthProvider.findByPk(req.params.id);
  if (!provider) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Провайдер не найден' } });

  const { name, config, isActive } = req.body;

  const changes = [];
  if (name && name !== provider.name) changes.push(`name: "${provider.name}" → "${name}"`);
  if (isActive !== undefined && isActive !== provider.isActive) changes.push(`isActive: ${provider.isActive} → ${isActive}`);
  if (config) {
    const old = provider.config || {};
    if (config.baseUrl !== old.baseUrl) changes.push(`baseUrl: "${old.baseUrl || ''}" → "${config.baseUrl}"`);
    if (config.authEndpoint !== old.authEndpoint) changes.push(`authEndpoint: "${old.authEndpoint || ''}" → "${config.authEndpoint}"`);
    if (config.timeout !== old.timeout) changes.push(`timeout: ${old.timeout || 5000} → ${config.timeout}`);
  }

  if (changes.length) {
    console.log(`[Provider] Обновление провайдера "${provider.name}" (${provider.id}):`);
    changes.forEach(c => console.log(`[Provider]   ${c}`));
  }

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

  console.log(`[Provider] Удаление провайдера "${provider.name}" (${provider.id}), type=${provider.type}`);
  await provider.destroy();
  res.status(204).send();
});

router.post('/auth-providers/:id/test', authenticate, requireAdmin, async (req, res) => {
  const { AuthProvider } = getModels();
  const provider = await AuthProvider.findByPk(req.params.id);
  if (!provider) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Провайдер не найден' } });

  if (provider.type === 'ONE_C') {
    const { login, password } = req.body;
    if (!login || !password) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Укажите логин и пароль для тестирования' } });
    }

    const config = provider.config || {};
    const url = `${config.baseUrl}${config.authEndpoint || '/auth/validate'}`;
    const timeout = config.timeout || 5000;

    const authHeader = 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64');

    console.log(`[Provider] Тест подключения "${provider.name}" (${provider.id})`);
    console.log(`[Provider]   URL: POST ${url}`);
    console.log(`[Provider]   Логин: ${login}`);
    console.log(`[Provider]   Authorization: Basic ${Buffer.from(`${login}:***`).toString('base64')}`);
    console.log(`[Provider]   Таймаут: ${timeout}ms`);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const testRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timer);

      console.log(`[Provider]   Ответ: HTTP ${testRes.status} ${testRes.statusText}`);

      let responseData = null;
      try {
        responseData = await testRes.json();
        console.log(`[Provider]   Body: ${JSON.stringify(responseData).substring(0, 500)}`);
      } catch {
        console.log(`[Provider]   Body: (не JSON)`);
      }

      if (!testRes.ok) {
        console.log(`[Provider]   Результат: ОШИБКА`);
        res.json({ data: { success: false, status: testRes.status, message: `Сервер вернул ${testRes.status}`, response: responseData } });
      } else {
        console.log(`[Provider]   Результат: УСПЕХ`);
        res.json({ data: { success: true, status: testRes.status, message: 'Подключение успешно', response: responseData } });
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log(`[Provider]   Результат: ТАЙМАУТ (${timeout}ms)`);
        res.json({ data: { success: false, message: `Сервер не ответил вовремя (таймаут ${timeout}ms)` } });
      } else {
        const cause = err.cause || {};
        console.error(`[Provider]   Результат: НЕДОСТУПЕН`);
        console.error(`[Provider]   Ошибка: ${err.message}`);
        console.error(`[Provider]   Тип: ${err.name || 'Error'}`);
        if (cause.code) console.error(`[Provider]   Код: ${cause.code}`);
        if (cause.syscall) console.error(`[Provider]   Syscall: ${cause.syscall}`);
        if (cause.hostname) console.error(`[Provider]   Hostname: ${cause.hostname}`);
        if (cause.port) console.error(`[Provider]   Port: ${cause.port}`);
        if (cause.address) console.error(`[Provider]   Address: ${cause.address}`);
        console.error(`[Provider]   Stack: ${err.stack}`);

        const detail = cause.code
          ? `${cause.code}${cause.address ? ` (${cause.address}:${cause.port})` : ''}`
          : err.message;
        res.json({ data: { success: false, message: `Недоступен: ${detail}` } });
      }
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
