<template>
  <AdminLayout>
    <v-container fluid>
      <v-row v-if="loading" justify="center" class="my-10">
        <v-progress-circular indeterminate color="primary" size="48" />
      </v-row>

      <template v-else>
        <div class="text-h5 font-weight-bold mb-6">Дашборд</div>

        <v-row>
          <v-col v-for="card in statCards" :key="card.label" cols="12" sm="6" md="4" lg="3">
            <v-card variant="outlined">
              <v-card-text class="text-center">
                <v-icon :icon="card.icon" size="32" :color="card.color || 'grey'" class="mb-2" />
                <div class="text-body-2 text-medium-emphasis">{{ card.label }}</div>
                <div class="text-h4 font-weight-bold" :style="card.color ? { color: card.color } : {}">
                  {{ card.value }}
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <div class="text-h6 mt-8 mb-4">Последние тикеты</div>

        <v-alert v-if="recentTickets.length === 0" type="info" variant="tonal" class="mb-4">
          Нет тикетов
        </v-alert>

        <v-card v-else variant="outlined">
          <v-list lines="two">
            <v-list-item
              v-for="t in recentTickets"
              :key="t.id"
              :to="`/tickets/${t.id}`"
              class="px-4"
            >
              <template #prepend>
                <span class="text-medium-emphasis text-body-2 mr-3">#{{ t.number }}</span>
              </template>

              <v-list-item-title>{{ t.title }}</v-list-item-title>
              <v-list-item-subtitle>{{ formatDateTime(t.createdAt) }}</v-list-item-subtitle>

              <template #append>
                <v-chip :color="statusColor(t.status)" size="small" label class="mr-2">
                  {{ formatStatus(t.status) }}
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </template>
    </v-container>
  </AdminLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '@/services/api.js';
import { toast } from '@/composables/useToast.js';
import { formatDateTime, formatStatus } from '@/utils/format.js';
import AdminLayout from '@/components/layout/AdminLayout.vue';

const loading = ref(true);
const statCards = ref([]);
const recentTickets = ref([]);

function statusColor(status) {
  const map = {
    OPEN: 'blue',
    IN_PROGRESS: 'orange',
    WAITING_FOR_USER: 'purple',
    RESOLVED: 'green',
    CLOSED: 'grey'
  };
  return map[status] || 'grey';
}

onMounted(async () => {
  try {
    const res = await api.get('/admin/dashboard');
    const { stats, recentTickets: tickets } = res.data;

    statCards.value = [
      { label: 'Всего тикетов', value: stats.totalTickets, icon: 'mdi-ticket-outline', color: undefined },
      { label: 'Открытых', value: stats.openTickets, color: '#1976D2', icon: 'mdi-folder-open-outline' },
      { label: 'В работе', value: stats.inProgressTickets, color: '#FB8C00', icon: 'mdi-progress-wrench' },
      { label: 'Решённых', value: stats.resolvedTickets, color: '#43A047', icon: 'mdi-check-circle-outline' },
      { label: 'Пользователей', value: stats.totalUsers, icon: 'mdi-account-group-outline', color: undefined },
      { label: 'Агентов/Админов', value: stats.totalAgents, icon: 'mdi-shield-account-outline', color: undefined },
      { label: 'Тем. групп', value: stats.totalGroups, icon: 'mdi-tag-multiple-outline', color: undefined }
    ];
    recentTickets.value = tickets;
  } catch (err) {
    toast.error(err.message);
  }
  loading.value = false;
});
</script>
