import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/services/api.js';
import { pushService } from '@/services/push.js';
import { WsClient } from '@/services/websocket.js';

export const useNotificationStore = defineStore('notifications', () => {
  const unreadCount = ref(0);
  let wsNotif = null;

  async function init() {
    await loadCount();
    await pushService.init();

    // WS-канал для real-time уведомлений
    wsNotif = new WsClient({
      onNotification: (data) => {
        unreadCount.value++;
      }
    });
    wsNotif.connect();
  }

  async function loadCount() {
    try {
      const res = await api.get('/notifications/count');
      unreadCount.value = res.data.count;
    } catch { /* silent */ }
  }

  async function loadList(limit = 20) {
    const res = await api.get('/notifications', { limit });
    return res.data || [];
  }

  async function markRead(id) {
    await api.put(`/notifications/${id}/read`);
    unreadCount.value = Math.max(0, unreadCount.value - 1);
  }

  async function markAllRead() {
    await api.put('/notifications/read-all');
    unreadCount.value = 0;
  }

  function destroy() {
    if (wsNotif) {
      wsNotif.destroy();
      wsNotif = null;
    }
  }

  return { unreadCount, init, loadCount, loadList, markRead, markAllRead, destroy };
});
