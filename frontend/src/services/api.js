/**
 * HTTP-клиент — обёртка над fetch.
 * Access token сохраняется в sessionStorage для переживания F5.
 * Refresh token в httpOnly cookie — автоматически обновляется.
 */
import config from '@/config.js';

const TOKEN_KEY = 'gdd_access_token';

class ApiService {
  constructor(baseUrl = config.apiUrl) {
    this.baseUrl = baseUrl;
    this.accessToken = sessionStorage.getItem(TOKEN_KEY) || null;
    this.onUnauthorized = null;
    this._refreshPromise = null;
  }

  setToken(token) {
    this.accessToken = token;
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  }

  clearToken() {
    this.accessToken = null;
    sessionStorage.removeItem(TOKEN_KEY);
  }

  async request(method, path, { body, query, headers = {} } = {}) {
    let url = `${this.baseUrl}${path}`;

    if (query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const opts = {
      method,
      headers: { ...headers },
      credentials: 'include'
    };

    if (this.accessToken) {
      opts.headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    if (body && !(body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      opts.body = body;
    }

    let response = await fetch(url, opts);

    // На 401 пробуем обновить токен один раз
    if (response.status === 401) {
      const refreshed = await this._tryRefresh();
      if (refreshed) {
        opts.headers['Authorization'] = `Bearer ${this.accessToken}`;
        response = await fetch(url, opts);
      }
    }

    return this._handleResponse(response);
  }

  async _handleResponse(response) {
    if (response.status === 204) return null;

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 && this.onUnauthorized) {
        this.clearToken();
        this.onUnauthorized();
      }

      const error = new Error(data.error?.message || 'Ошибка запроса');
      error.status = response.status;
      error.code = data.error?.code;
      error.details = data.error?.details;
      throw error;
    }

    return data;
  }

  async _tryRefresh() {
    // Дедупликация: если уже идёт refresh, ждём его
    if (this._refreshPromise) return this._refreshPromise;

    this._refreshPromise = (async () => {
      try {
        const res = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          credentials: 'include'
        });

        if (!res.ok) return false;

        const data = await res.json();
        if (data.accessToken) {
          this.setToken(data.accessToken);
          return true;
        }
      } catch {
        // refresh не удался
      }
      return false;
    })();

    const result = await this._refreshPromise;
    this._refreshPromise = null;
    return result;
  }

  get(path, query) { return this.request('GET', path, { query }); }
  post(path, body) { return this.request('POST', path, { body }); }
  put(path, body) { return this.request('PUT', path, { body }); }
  delete(path) { return this.request('DELETE', path); }
  upload(path, formData) { return this.request('POST', path, { body: formData }); }
}

export const api = new ApiService();
