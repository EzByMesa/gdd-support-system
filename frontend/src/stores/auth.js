import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/services/api.js';
import { useNotificationStore } from './notifications.js';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const knowledgeEnabled = ref(false);

  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.role === 'ADMIN');
  const isSeniorAgent = computed(() => user.value?.role === 'SENIOR_AGENT');
  const isAgent = computed(() => user.value?.role === 'AGENT');
  const isStaff = computed(() => ['AGENT', 'SENIOR_AGENT', 'ADMIN'].includes(user.value?.role));

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

  async function fetchOneCProfile(login, password) {
    const data = await api.post('/auth/1c/profile', { login, password });
    return data.data;
  }

  async function registerOneC(login, password) {
    const data = await api.post('/auth/register/1c', { login, password });
    api.setToken(data.accessToken);
    user.value = data.user;
    return user.value;
  }

  async function logout() {
    try { await api.post('/auth/logout'); } catch { /* OK */ }
    // Уничтожаем WS-подключение уведомлений (чтобы не получать чужие)
    const notifStore = useNotificationStore();
    notifStore.destroy();
    api.clearToken();
    user.value = null;
  }

  // НЕ обнуляем user при 401 — router guard сам восстановит сессию.
  // Только чистим протухший access token, чтобы при следующем запросе
  // _tryRefresh вернул новый.
  api.onUnauthorized = () => {
    // Не трогаем user.value — пусть router guard решает
  };

  return { user, knowledgeEnabled, isAuthenticated, isAdmin, isSeniorAgent, isAgent, isStaff, tryRestore, login, register, fetchOneCProfile, registerOneC, logout };
});
