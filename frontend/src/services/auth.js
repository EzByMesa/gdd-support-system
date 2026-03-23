/**
 * Сервис аутентификации.
 * Управление токенами, текущим пользователем.
 */
export class AuthService {
  constructor(api) {
    this.api = api;
    this.user = null;
    this._listeners = [];
  }

  /**
   * Попытка восстановить сессию (refresh token в cookie)
   */
  async tryRestore() {
    try {
      const data = await this.api.request('GET', '/auth/me');
      if (data?.data) {
        this.user = data.data;
        // accessToken уже восстановлен через refresh в api.request
        return true;
      }
    } catch {
      this.user = null;
    }
    return false;
  }

  /**
   * Вход
   */
  async login(login, password) {
    const data = await this.api.post('/auth/login', { login, password });
    this.api.setToken(data.accessToken);
    this.user = data.user;
    this._notify();
    return this.user;
  }

  /**
   * Регистрация
   */
  async register({ login, email, password, displayName }) {
    const data = await this.api.post('/auth/register', { login, email, password, displayName });
    this.api.setToken(data.accessToken);
    this.user = data.user;
    this._notify();
    return this.user;
  }

  /**
   * Вход через 1С
   */
  async loginOneC(login, password) {
    const data = await this.api.post('/auth/1c', { login, password });
    this.api.setToken(data.accessToken);
    this.user = data.user;
    this._notify();
    return this.user;
  }

  /**
   * Выход
   */
  async logout() {
    try {
      await this.api.post('/auth/logout');
    } catch {
      // OK
    }
    this.api.clearToken();
    this.user = null;
    this._notify();
  }

  /**
   * Получить текущего пользователя
   */
  getUser() {
    return this.user;
  }

  isAuthenticated() {
    return !!this.user;
  }

  isAdmin() {
    return this.user?.role === 'ADMIN';
  }

  isAgent() {
    return this.user?.role === 'AGENT';
  }

  /**
   * Подписка на изменения авторизации
   */
  onChange(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter(l => l !== fn);
    };
  }

  _notify() {
    this._listeners.forEach(fn => fn(this.user));
  }
}
