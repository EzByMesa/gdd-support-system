import { api } from './api.js';

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

class PushService {
  constructor() {
    this.registration = null;
    this.subscription = null;
    this._initDone = false;
  }

  get supported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  async init() {
    if (this._initDone || !this.supported) return;
    this._initDone = true;

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      this.subscription = await this.registration.pushManager.getSubscription();
      if (this.subscription) {
        await this._syncSubscription(this.subscription);
      }
      console.log('[Push] SW зарегистрирован, подписка:', !!this.subscription);
    } catch (err) {
      console.error('[Push] Ошибка инициализации:', err);
    }
  }

  async subscribe() {
    if (!this.supported) throw new Error('Push-уведомления не поддерживаются в этом браузере');

    // Убедимся, что SW зарегистрирован
    if (!this.registration) await this.init();
    if (!this.registration) throw new Error('Не удалось зарегистрировать Service Worker');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Вы отклонили разрешение на уведомления. Разрешите в настройках браузера.');
    }

    const res = await api.get('/push/vapid-key');
    const vapidPublicKey = res.data.publicKey;
    if (!vapidPublicKey) throw new Error('VAPID ключ не настроен на сервере');

    this.subscription = await this.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    await this._syncSubscription(this.subscription);
    console.log('[Push] Подписка создана');
    return true;
  }

  async unsubscribe() {
    if (this.subscription) {
      const endpoint = this.subscription.endpoint;
      await this.subscription.unsubscribe();
      this.subscription = null;
      try {
        await api.request('DELETE', '/push/subscribe', { body: { endpoint } });
      } catch { /* OK */ }
      console.log('[Push] Подписка удалена');
    }
  }

  async isSubscribed() {
    if (this.subscription) return true;
    if (this.registration) {
      this.subscription = await this.registration.pushManager.getSubscription();
      return !!this.subscription;
    }
    return false;
  }

  async _syncSubscription(subscription) {
    try {
      const json = subscription.toJSON();
      await api.post('/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
    } catch { /* silent */ }
  }
}

export const pushService = new PushService();
