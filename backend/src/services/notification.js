/**
 * Сервис уведомлений.
 * Каналы: В приложении (всегда) + Push (если подписан) + Email (если настроен)
 *
 * УМНАЯ МАРШРУТИЗАЦИЯ:
 * Если пользователь ОНЛАЙН (есть активное WS-соединение),
 * уведомление отправляется ТОЛЬКО в приложение (WS + БД).
 * Push и Email отправляются только если пользователь ОФФЛАЙН
 * и канал включён в его настройках.
 */
import webpush from 'web-push';
import { getModels } from '../models/index.js';
import { sendToUser, isUserOnline } from '../websocket/wsServer.js';
import { sendNotificationEmail } from './email.js';

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
 * Получить настройки уведомлений пользователя для конкретного триггера.
 * Возвращает { channelApp, channelPush, channelEmail } или defaults.
 */
async function getUserPreference(userId, trigger) {
  const { NotificationPreference } = getModels();
  const pref = await NotificationPreference.findOne({
    where: { userId, trigger }
  });

  // Дефолты: app=true, push=true, email=false
  return {
    channelApp: pref ? pref.channelApp : true,
    channelPush: pref ? pref.channelPush : true,
    channelEmail: pref ? pref.channelEmail : false,
  };
}

/**
 * Отправить уведомление пользователю.
 * Умная маршрутизация: если онлайн — только in-app.
 *
 * @param {string} userId
 * @param {object} opts - { type, title, body, data }
 */
export async function notify(userId, { type, title, body, data = {} }) {
  const { Notification, PushSubscription, User } = getModels();

  // Получаем настройки каналов для этого триггера
  const prefs = await getUserPreference(userId, type);

  // 1. Всегда сохраняем в БД (если канал app включён)
  let notification = null;
  if (prefs.channelApp) {
    notification = await Notification.create({
      userId, type, title, body, data
    });
  }

  // Проверяем, онлайн ли пользователь
  const online = isUserOnline(userId);

  // 2. WebSocket (если онлайн и app включён)
  if (online && prefs.channelApp) {
    sendToUser(userId, {
      type: 'notification',
      data: {
        id: notification?.id,
        type, title, body, data,
        isRead: false,
        createdAt: notification?.createdAt || new Date()
      }
    });
  }

  // 3. Если пользователь ОНЛАЙН — не отправляем push и email (анти-спам)
  if (online) {
    return notification;
  }

  // 4. Web Push (если оффлайн + канал включён + есть подписки)
  if (prefs.channelPush && vapidConfigured) {
    const subscriptions = await PushSubscription.findAll({ where: { userId } });
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify({
            title, body,
            data: { ...data, notificationId: notification?.id },
            tag: data.ticketId ? `ticket-${data.ticketId}` : `notif-${notification?.id}`
          })
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await sub.destroy();
        }
      }
    }
  }

  // 5. Email (если оффлайн + канал включён + есть верифицированный email)
  if (prefs.channelEmail) {
    const user = await User.findByPk(userId, { attributes: ['verifiedEmail'] });
    if (user?.verifiedEmail) {
      sendNotificationEmail(
        user.verifiedEmail,
        title,
        body,
        data.ticketNumber || null
      ).catch(() => {});
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
