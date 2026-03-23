/**
 * Сервис уведомлений.
 * 3 канала: БД (всегда) + Web Push (если подписан) + WebSocket (если онлайн).
 */
import webpush from 'web-push';
import { getModels } from '../models/index.js';
import { sendToUser } from '../websocket/wsServer.js';

let vapidConfigured = false;

/**
 * Инициализация VAPID для Web Push
 */
export async function initVapid() {
  try {
    const { SystemSettings } = getModels();

    let pubKey = await SystemSettings.findOne({ where: { key: 'push.vapidPublicKey' } });
    let privKey = await SystemSettings.findOne({ where: { key: 'push.vapidPrivateKey' } });

    if (!pubKey || !privKey) {
      // Генерируем VAPID ключи
      const keys = webpush.generateVAPIDKeys();

      await SystemSettings.findOrCreate({
        where: { key: 'push.vapidPublicKey' },
        defaults: { value: keys.publicKey }
      });
      await SystemSettings.findOrCreate({
        where: { key: 'push.vapidPrivateKey' },
        defaults: { value: keys.privateKey }
      });

      pubKey = { value: keys.publicKey };
      privKey = { value: keys.privateKey };

      console.log('[Push] VAPID ключи сгенерированы');
    }

    webpush.setVapidDetails(
      'mailto:admin@gdd-support.local',
      pubKey.value,
      privKey.value
    );

    vapidConfigured = true;
    console.log('[Push] VAPID настроен');
  } catch (err) {
    console.error('[Push] Ошибка инициализации VAPID:', err.message);
  }
}

/**
 * Отправить уведомление пользователю
 * @param {string} userId
 * @param {object} opts - { type, title, body, data }
 */
export async function notify(userId, { type, title, body, data = {} }) {
  const { Notification, PushSubscription } = getModels();

  // 1. Сохраняем в БД
  const notification = await Notification.create({
    userId,
    type,
    title,
    body,
    data
  });

  // 2. WebSocket (если онлайн)
  sendToUser(userId, {
    type: 'notification',
    data: {
      id: notification.id,
      type,
      title,
      body,
      data,
      isRead: false,
      createdAt: notification.createdAt
    }
  });

  // 3. Web Push (если есть подписки)
  if (vapidConfigured) {
    const subscriptions = await PushSubscription.findAll({ where: { userId } });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify({
            title,
            body,
            data: { ...data, notificationId: notification.id },
            tag: data.ticketId ? `ticket-${data.ticketId}` : `notif-${notification.id}`
          })
        );
      } catch (err) {
        // 410 Gone — подписка протухла
        if (err.statusCode === 410 || err.statusCode === 404) {
          await sub.destroy();
        }
      }
    }
  }

  return notification;
}

/**
 * Получить публичный VAPID ключ
 */
export async function getVapidPublicKey() {
  const { SystemSettings } = getModels();
  const setting = await SystemSettings.findOne({ where: { key: 'push.vapidPublicKey' } });
  return setting?.value || null;
}
