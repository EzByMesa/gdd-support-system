/**
 * Сервис управления уведомлениями (in-app).
 * Загрузка, count, mark read.
 */

export class NotificationService {
  constructor(api) {
    this.api = api;
    this.unreadCount = 0;
    this._listeners = [];
  }

  async loadCount() {
    try {
      const res = await this.api.get('/notifications/count');
      this.unreadCount = res.data.count;
      this._notify();
    } catch {
      // silent
    }
    return this.unreadCount;
  }

  async loadList(limit = 20) {
    const res = await this.api.get('/notifications', { limit });
    return res.data || [];
  }

  async markRead(id) {
    await this.api.put(`/notifications/${id}/read`);
    this.unreadCount = Math.max(0, this.unreadCount - 1);
    this._notify();
  }

  async markAllRead() {
    await this.api.put('/notifications/read-all');
    this.unreadCount = 0;
    this._notify();
  }

  /**
   * Обработать WS notification (real-time обновление)
   */
  handleIncoming(notifData) {
    this.unreadCount++;
    this._notify();
  }

  onChange(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(l => l !== fn); };
  }

  _notify() {
    this._listeners.forEach(fn => fn(this.unreadCount));
  }
}
