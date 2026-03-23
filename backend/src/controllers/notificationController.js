import { getModels } from '../models/index.js';
import { getVapidPublicKey } from '../services/notification.js';

/**
 * GET /api/notifications
 */
export async function listNotifications(req, res) {
  const { limit = 20, unread } = req.query;
  const { Notification } = getModels();

  const where = { userId: req.user.sub };
  if (unread === 'true') where.isRead = false;

  const notifications = await Notification.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit)
  });

  res.json({ data: notifications });
}

/**
 * GET /api/notifications/count
 */
export async function countUnread(req, res) {
  const { Notification } = getModels();

  const count = await Notification.count({
    where: { userId: req.user.sub, isRead: false }
  });

  res.json({ data: { count } });
}

/**
 * PUT /api/notifications/:id/read
 */
export async function markRead(req, res) {
  const { Notification } = getModels();

  const notif = await Notification.findByPk(req.params.id);
  if (!notif || notif.userId !== req.user.sub) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Уведомление не найдено' } });
  }

  await notif.update({ isRead: true });
  res.json({ data: notif });
}

/**
 * PUT /api/notifications/read-all
 */
export async function markAllRead(req, res) {
  const { Notification } = getModels();

  await Notification.update(
    { isRead: true },
    { where: { userId: req.user.sub, isRead: false } }
  );

  res.json({ data: { success: true } });
}

/**
 * GET /api/push/vapid-key
 */
export async function vapidKey(req, res) {
  const key = await getVapidPublicKey();
  if (!key) {
    return res.status(500).json({ error: { code: 'NOT_CONFIGURED', message: 'VAPID не настроен' } });
  }
  res.json({ data: { publicKey: key } });
}

/**
 * POST /api/push/subscribe
 */
export async function pushSubscribe(req, res) {
  const { endpoint, keys } = req.body;

  if (!endpoint || !keys) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Невалидная подписка' }
    });
  }

  const { PushSubscription } = getModels();

  // Удаляем старую подписку с тем же endpoint
  await PushSubscription.destroy({ where: { endpoint } });

  const sub = await PushSubscription.create({
    userId: req.user.sub,
    endpoint,
    keys
  });

  res.status(201).json({ data: { id: sub.id } });
}

/**
 * DELETE /api/push/subscribe
 */
export async function pushUnsubscribe(req, res) {
  const { endpoint } = req.body;
  const { PushSubscription } = getModels();

  if (endpoint) {
    await PushSubscription.destroy({ where: { userId: req.user.sub, endpoint } });
  } else {
    await PushSubscription.destroy({ where: { userId: req.user.sub } });
  }

  res.status(204).send();
}
