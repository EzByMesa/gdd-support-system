import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/services/api.js';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);

  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.role === 'ADMIN');
  const isAgent = computed(() => user.value?.role === 'AGENT');

  /**
   * Попытка восстановить сессию через refresh cookie.
   * Вызывается при старте и в router guard при потере сессии.
   */
  async function tryRestore() {
    try {
      // Если нет access token, _tryRefresh сработает внутри api.request
      const data = await api.request('GET', '/auth/me');
      if (data?.data) {
        user.value = data.data;
        return true;
      }
    } catch {
      // Refresh не удался — пользователь действительно не авторизован
      user.value = null;
      api.clearToken();
    }
    return false;
  }

  async function login(login, password) {
    const data = await api.post('/auth/login', { login, password });
    api.setToken(data.accessToken);
    user.value = data.user;
    return user.value;
  }

  async function register({ login, email, password, displayName }) {
    const data = await api.post('/auth/register', { login, email, password, displayName });
    api.setToken(data.accessToken);
    user.value = data.user;
    return user.value;
  }

  async function loginOneC(login, password) {
    const data = await api.post('/auth/1c', { login, password });
    api.setToken(data.accessToken);
    user.value = data.user;
    return user.value;
  }

  async function logout() {
    try { await api.post('/auth/logout'); } catch { /* OK */ }
    api.clearToken();
    user.value = null;
  }

  // НЕ обнуляем user при 401 — router guard сам восстановит сессию.
  // Только чистим протухший access token, чтобы при следующем запросе
  // _tryRefresh вернул новый.
  api.onUnauthorized = () => {
    // Не трогаем user.value — пусть router guard решает
  };

  return { user, isAuthenticated, isAdmin, isAgent, tryRestore, login, register, loginOneC, logout };
});
