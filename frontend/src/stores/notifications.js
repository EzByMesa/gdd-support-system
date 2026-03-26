import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/services/api.js';
import { pushService } from '@/services/push.js';
import { WsClient } from '@/services/websocket.js';
import { toast } from '@/composables/useToast.js';

export const useNotificationStore = defineStore('notifications', () => {
  const unreadCount = ref(0);
  const ticketsUpdatedAt = ref(0);
  const profileUpdatedAt = ref(0);
  let wsNotif = null;

  async function init() {
    destroy();

    await loadCount();
    await pushService.init();

    wsNotif = new WsClient({
      onNotification: (data) => {
        unreadCount.value++;
        if (data?.title || data?.body) {
          toast.info(`${data.title || ''}${data.body ? ': ' + data.body : ''}`);
        }
      },
      onTicketsUpdated: () => {
        ticketsUpdatedAt.value = Date.now();
      },
      onProfileUpdated: () => {
        profileUpdatedAt.value = Date.now();
      },
      onForceLogout: () => {
        toast.error('Ваша учётная запись деактивирована');
        setTimeout(() => { window.location.href = '/login'; }, 2000);
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

  async function deleteOne(id) {
    await api.delete(`/notifications/${id}`);
    unreadCount.value = Math.max(0, unreadCount.value - 1);
  }

  async function deleteAll() {
    await api.delete('/notifications/all');
    unreadCount.value = 0;
  }

  function destroy() {
    if (wsNotif) {
      wsNotif.destroy();
      wsNotif = null;
    }
  }

  return { unreadCount, ticketsUpdatedAt, profileUpdatedAt, init, loadCount, loadList, markRead, markAllRead, deleteOne, deleteAll, destroy };
});
