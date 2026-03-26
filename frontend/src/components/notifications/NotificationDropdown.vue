<template>
  <div style="overflow-y: auto; flex: 1">
    <!-- Actions bar -->
    <div v-if="notifications.length > 0" class="d-flex justify-space-between align-center px-3 py-1">
      <v-btn variant="text" size="x-small" color="primary" @click="markAllRead">
        Прочитать все
      </v-btn>
      <v-btn variant="text" size="x-small" color="error" @click="handleDeleteAll">
        Очистить все
      </v-btn>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" />

    <div v-if="!loading && notifications.length === 0" class="text-center py-8">
      <v-icon size="36" style="opacity: 0.15">mdi-bell-off-outline</v-icon>
      <div class="text-caption mt-2" style="color: rgba(255,255,255,0.25)">Нет уведомлений</div>
    </div>

    <v-list v-else density="compact" bg-color="transparent" class="py-0">
      <v-list-item v-for="n in notifications" :key="n.id" @click="handleClick(n)"
        :style="!n.isRead ? 'background: rgba(139,157,195,0.08)' : ''"
        class="px-3 py-2" style="min-height: 48px; cursor: pointer">
        <template #prepend>
          <v-icon :color="typeColor(n.type)" size="18" class="mr-2">{{ typeIcon(n.type) }}</v-icon>
        </template>
        <v-list-item-title class="text-body-2" :class="{ 'font-weight-bold': !n.isRead }">
          {{ n.title }}
        </v-list-item-title>
        <v-list-item-subtitle class="text-caption">{{ n.body }}</v-list-item-subtitle>
        <template #append>
          <v-btn icon variant="text" size="x-small" color="grey" @click.stop="handleDelete(n)">
            <v-icon size="14">mdi-close</v-icon>
          </v-btn>
        </template>
      </v-list-item>
    </v-list>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationStore } from '@/stores/notifications.js';

const emit = defineEmits(['close']);
const router = useRouter();
const notifStore = useNotificationStore();

const loading = ref(true);
const notifications = ref([]);

const iconMap = {
  NEW_TICKET: 'mdi-ticket-outline', NEW_MESSAGE: 'mdi-chat',
  STATUS_CHANGED: 'mdi-swap-vertical', TICKET_ASSIGNED: 'mdi-account-check',
  DELEGATION_REQUEST: 'mdi-swap-horizontal', DELEGATION_ACCEPTED: 'mdi-check',
  DELEGATION_REJECTED: 'mdi-close', AGENT_CHANGED: 'mdi-account-switch'
};
const colorMap = {
  NEW_TICKET: 'primary', NEW_MESSAGE: 'info',
  STATUS_CHANGED: 'warning', TICKET_ASSIGNED: 'success',
  DELEGATION_REQUEST: 'primary', DELEGATION_ACCEPTED: 'success',
  DELEGATION_REJECTED: 'error', AGENT_CHANGED: 'info'
};

function typeIcon(t) { return iconMap[t] || 'mdi-bell'; }
function typeColor(t) { return colorMap[t] || 'grey'; }

async function handleClick(n) {
  if (!n.isRead) await notifStore.markRead(n.id);
  if (n.data?.ticketId) router.push(`/tickets/${n.data.ticketId}`);
  emit('close');
}

async function markAllRead() {
  await notifStore.markAllRead();
  notifications.value.forEach(n => n.isRead = true);
}

async function handleDelete(n) {
  await notifStore.deleteOne(n.id);
  notifications.value = notifications.value.filter(x => x.id !== n.id);
}

async function handleDeleteAll() {
  if (!confirm('Удалить все уведомления?')) return;
  await notifStore.deleteAll();
  notifications.value = [];
}

onMounted(async () => {
  try {
    const list = await notifStore.loadList();
    notifications.value = list || [];
  } catch { /* */ }
  loading.value = false;
});
</script>
