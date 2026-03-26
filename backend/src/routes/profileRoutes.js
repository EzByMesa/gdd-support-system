/**
 * Роуты личного кабинета (ЛК).
 * Профиль, настройки уведомлений, верификация email.
 */
import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { resolve, extname } from 'path';
import { authenticate } from '../middleware/auth.js';
import { getModels } from '../models/index.js';
import { sendVerificationCode } from '../services/email.js';
import { isSmtpConfigured } from '../services/email.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotificationType } from '../models/enums.js';
import { sendToUser } from '../websocket/wsServer.js';

const AVATARS_DIR = resolve(process.cwd(), 'data', 'avatars');
if (!existsSync(AVATARS_DIR)) mkdirSync(AVATARS_DIR, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: AVATARS_DIR,
    filename: (req, file, cb) => {
      const ext = extname(file.originalname) || '.jpg';
      cb(null, `${req.user.sub}${ext}`);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Допустимы только изображения (JPEG, PNG, GIF, WebP)'));
  }
});

const router = Router();

// ==================== PROFILE ====================

/**
 * GET /api/profile — текущий профиль
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { User } = getModels();
  const user = await User.findByPk(req.user.sub, {
    attributes: ['id', 'login', 'email', 'displayName', 'role', 'verifiedEmail', 'avatarPath', 'createdAt']
  });
  if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Пользователь не найден' } });
  res.json({ data: user.toJSON() });
}));

/**
 * PUT /api/profile — обновить профиль
 */
router.put('/', authenticate, asyncHandler(async (req, res) => {
  const { User } = getModels();
  const user = await User.findByPk(req.user.sub);
  if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND' } });

  const { displayName, email } = req.body;
  if (displayName) user.displayName = displayName;
  if (email !== undefined) user.email = email;

  await user.save();
  const userData = {
    id: user.id, login: user.login, email: user.email,
    displayName: user.displayName, role: user.role,
    verifiedEmail: user.verifiedEmail, avatarPath: user.avatarPath
  };
  res.json({ data: userData });

  // WS: обновить данные во всех открытых вкладках
  sendToUser(user.id, { type: 'profile_updated', data: userData });
}));

/**
 * PUT /api/profile/password — сменить пароль
 */
router.put('/password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const { User } = getModels();

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Укажите текущий и новый пароль' } });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Минимум 8 символов' } });
  }

  const user = await User.findByPk(req.user.sub);
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Неверный текущий пароль' } });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  res.json({ data: { success: true } });
}));

// ==================== EMAIL VERIFICATION ====================

/**
 * POST /api/profile/email/send-code — отправить код подтверждения на email
 */
router.post('/email/send-code', authenticate, asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Укажите email' } });

  if (!isSmtpConfigured()) {
    return res.status(400).json({ error: { code: 'SMTP_NOT_CONFIGURED', message: 'SMTP сервер не настроен. Обратитесь к администратору.' } });
  }

  const { EmailVerification } = getModels();

  // Генерируем 6-значный код
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут

  // Удаляем старые коды для этого юзера
  await EmailVerification.destroy({ where: { userId: req.user.sub } });

  await EmailVerification.create({
    userId: req.user.sub,
    email,
    code,
    expiresAt
  });

  const sent = await sendVerificationCode(email, code);
  if (!sent) {
    return res.status(500).json({ error: { code: 'EMAIL_SEND_FAILED', message: 'Не удалось отправить email' } });
  }

  res.json({ data: { success: true, message: 'Код отправлен' } });
}));

/**
 * POST /api/profile/email/verify — подтвердить email кодом
 */
router.post('/email/verify', authenticate, asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Укажите код' } });

  const { EmailVerification, User } = getModels();

  const verification = await EmailVerification.findOne({
    where: { userId: req.user.sub, verified: false },
    order: [['createdAt', 'DESC']]
  });

  if (!verification) {
    return res.status(400).json({ error: { code: 'NOT_FOUND', message: 'Запрос на подтверждение не найден' } });
  }

  if (new Date() > verification.expiresAt) {
    return res.status(400).json({ error: { code: 'EXPIRED', message: 'Код истёк. Запросите новый.' } });
  }

  if (verification.code !== code) {
    return res.status(400).json({ error: { code: 'INVALID_CODE', message: 'Неверный код' } });
  }

  verification.verified = true;
  await verification.save();

  // Сохраняем верифицированный email в профиле
  await User.update({ verifiedEmail: verification.email }, { where: { id: req.user.sub } });

  res.json({ data: { success: true, verifiedEmail: verification.email } });
}));

/**
 * DELETE /api/profile/email/verified — отвязать верифицированный email
 */
router.delete('/email/verified', authenticate, asyncHandler(async (req, res) => {
  const { User } = getModels();
  await User.update({ verifiedEmail: null }, { where: { id: req.user.sub } });
  res.json({ data: { success: true } });
}));

// ==================== NOTIFICATION PREFERENCES ====================

/**
 * Триггеры по ролям.
 */
const TRIGGERS_BY_ROLE = {
  USER: [
    { trigger: 'NEW_MESSAGE', label: 'Новое сообщение в чате' },
    { trigger: 'STATUS_CHANGED', label: 'Смена статуса обращения' },
    { trigger: 'TICKET_ASSIGNED', label: 'Агент назначен на обращение' },
    { trigger: 'AGENT_CHANGED', label: 'Смена агента' },
  ],
  AGENT: [
    { trigger: 'NEW_MESSAGE', label: 'Новое сообщение в чате' },
    { trigger: 'STATUS_CHANGED', label: 'Смена статуса обращения' },
    { trigger: 'TICKET_ASSIGNED', label: 'Назначение на тикет' },
    { trigger: 'DELEGATION_REQUEST', label: 'Запрос на делегирование' },
    { trigger: 'DELEGATION_ACCEPTED', label: 'Делегирование принято' },
    { trigger: 'DELEGATION_REJECTED', label: 'Делегирование отклонено' },
    { trigger: 'AGENT_CHANGED', label: 'Смена агента' },
  ],
  ADMIN: [
    { trigger: 'NEW_MESSAGE', label: 'Новое сообщение в чате' },
    { trigger: 'STATUS_CHANGED', label: 'Смена статуса обращения' },
    { trigger: 'TICKET_ASSIGNED', label: 'Назначение на тикет' },
    { trigger: 'DELEGATION_REQUEST', label: 'Запрос на делегирование' },
    { trigger: 'DELEGATION_ACCEPTED', label: 'Делегирование принято' },
    { trigger: 'DELEGATION_REJECTED', label: 'Делегирование отклонено' },
    { trigger: 'AGENT_CHANGED', label: 'Смена агента' },
  ]
};

/**
 * GET /api/profile/notification-preferences — матрица настроек
 */
router.get('/notification-preferences', authenticate, asyncHandler(async (req, res) => {
  const { NotificationPreference } = getModels();
  const role = req.user.role;
  const triggers = TRIGGERS_BY_ROLE[role] || TRIGGERS_BY_ROLE.USER;

  const prefs = await NotificationPreference.findAll({
    where: { userId: req.user.sub }
  });
  const prefsMap = new Map(prefs.map(p => [p.trigger, p]));

  const matrix = triggers.map(t => {
    const p = prefsMap.get(t.trigger);
    return {
      trigger: t.trigger,
      label: t.label,
      channelApp: p ? p.channelApp : true,
      channelPush: p ? p.channelPush : true,
      channelEmail: p ? p.channelEmail : false,
    };
  });

  res.json({ data: matrix });
}));

/**
 * PUT /api/profile/notification-preferences — обновить настройки
 * Body: { preferences: [{ trigger, channelApp, channelPush, channelEmail }, ...] }
 */
router.put('/notification-preferences', authenticate, asyncHandler(async (req, res) => {
  const { preferences } = req.body;
  const { NotificationPreference } = getModels();

  if (!Array.isArray(preferences)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Ожидается массив preferences' } });
  }

  for (const p of preferences) {
    const [pref] = await NotificationPreference.findOrCreate({
      where: { userId: req.user.sub, trigger: p.trigger },
      defaults: {
        channelApp: p.channelApp ?? true,
        channelPush: p.channelPush ?? true,
        channelEmail: p.channelEmail ?? false,
      }
    });

    if (pref) {
      pref.channelApp = p.channelApp ?? pref.channelApp;
      pref.channelPush = p.channelPush ?? pref.channelPush;
      pref.channelEmail = p.channelEmail ?? pref.channelEmail;
      await pref.save();
    }
  }

  res.json({ data: { success: true } });
}));

// ==================== PUSH SUBSCRIPTION STATUS ====================

/**
 * GET /api/profile/push-status — есть ли push-подписка у текущего браузера
 */
router.get('/push-status', authenticate, asyncHandler(async (req, res) => {
  const { PushSubscription } = getModels();
  const count = await PushSubscription.count({ where: { userId: req.user.sub } });
  res.json({ data: { subscribed: count > 0, count } });
}));

/**
 * GET /api/profile/smtp-status — настроен ли SMTP (для UI)
 */
router.get('/smtp-status', authenticate, asyncHandler(async (req, res) => {
  res.json({ data: { configured: isSmtpConfigured() } });
}));

// ==================== AVATAR ====================

/**
 * POST /api/profile/avatar — загрузить аватарку
 */
router.post('/avatar', authenticate, avatarUpload.single('avatar'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Файл не загружен' } });
  }
  const { User } = getModels();
  const user = await User.findByPk(req.user.sub);
  user.avatarPath = `/api/profile/avatar/${req.user.sub}`;
  await user.save();
  res.json({ data: { avatarUrl: user.avatarPath } });
  sendToUser(user.id, { type: 'profile_updated' });
}));

/**
 * GET /api/profile/avatar/:userId — отдать аватарку
 */
router.get('/avatar/:userId', asyncHandler(async (req, res) => {
  const { readdirSync } = await import('fs');
  const files = readdirSync(AVATARS_DIR);
  const match = files.find(f => f.startsWith(req.params.userId));
  if (!match) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Аватарка не найдена' } });
  }
  res.sendFile(resolve(AVATARS_DIR, match));
}));

/**
 * DELETE /api/profile/avatar — удалить аватарку
 */
router.delete('/avatar', authenticate, asyncHandler(async (req, res) => {
  const { unlinkSync, readdirSync } = await import('fs');
  const files = readdirSync(AVATARS_DIR);
  const match = files.find(f => f.startsWith(req.user.sub));
  if (match) unlinkSync(resolve(AVATARS_DIR, match));
  const { User } = getModels();
  const user = await User.findByPk(req.user.sub);
  user.avatarPath = null;
  await user.save();
  res.status(204).send();
  sendToUser(user.id, { type: 'profile_updated' });
}));

export default router;
