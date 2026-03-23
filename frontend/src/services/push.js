/**
 * Сервис Push-уведомлений.
 * Регистрация Service Worker, подписка на Web Push.
 */

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export class PushService {
  constructor(api) {
    this.api = api;
    this.registration = null;
    this.subscription = null;
  }

  /**
   * Инициализация: регистрация SW + подписка если разрешено
   */
  async init() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[Push] Push API не поддерживается');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');

      // Проверяем существующую подписку
      this.subscription = await this.registration.pushManager.getSubscription();

      if (this.subscription) {
        // Уже подписаны — синхронизируем с сервером
        await this._syncSubscription(this.subscription);
      }
    } catch (err) {
      console.error('[Push] Ошибка инициализации:', err);
    }
  }

  /**
   * Запросить разрешение и подписаться
   */
  async subscribe() {
    if (!this.registration) return false;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    try {
      // Получаем VAPID ключ с сервера
      const res = await this.api.get('/push/vapid-key');
      const vapidPublicKey = res.data.publicKey;

      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      await this._syncSubscription(this.subscription);
      return true;
    } catch (err) {
      console.error('[Push] Ошибка подписки:', err);
      return false;
    }
  }

  /**
   * Отписаться
   */
  async unsubscribe() {
    if (this.subscription) {
      const endpoint = this.subscription.endpoint;
      await this.subscription.unsubscribe();
      this.subscription = null;

      try {
        await this.api.request('DELETE', '/push/subscribe', { body: { endpoint } });
      } catch {
        // OK
      }
    }
  }

  isSubscribed() {
    return !!this.subscription;
  }

  async _syncSubscription(subscription) {
    try {
      const json = subscription.toJSON();
      await this.api.post('/push/subscribe', {
        endpoint: json.endpoint,
        keys: json.keys
      });
    } catch {
      // silent
    }
  }
}
