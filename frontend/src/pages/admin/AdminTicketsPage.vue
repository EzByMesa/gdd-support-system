<template>
  <AdminLayout>
    <v-container fluid>
      <div class="text-h5 font-weight-bold mb-6">Все тикеты</div>

      <v-row class="mb-4">
        <v-col cols="12" sm="6" md="4">
          <v-select
            v-model="filters.status"
            :items="statusOptions"
            item-title="text"
            item-value="value"
            label="Статус"
            variant="outlined"
            density="compact"
            hide-details
            @update:model-value="page = 1; load()"
          />
        </v-col>
        <v-col cols="12" sm="6" md="4">
          <v-select
            v-model="filters.priority"
            :items="priorityOptions"
            item-title="text"
            item-value="value"
            label="Приоритет"
            variant="outlined"
            density="compact"
            hide-details
            @update:model-value="page = 1; load()"
          />
        </v-col>
      </v-row>

      <v-row v-if="loading" justify="center" class="my-10">
        <v-progress-circular indeterminate color="primary" size="48" />
      </v-row>

      <v-alert v-else-if="tickets.length === 0" type="info" variant="tonal">
        Нет тикетов
      </v-alert>

      <v-card v-else variant="outlined">
        <v-list lines="two">
          <v-list-item
            v-for="t in tickets"
            :key="t.id"
            :to="`/tickets/${t.id}`"
            class="px-4"
          >
            <template #prepend>
              <span class="text-medium-emphasis text-body-2 mr-3" style="min-width: 40px">#{{ t.number }}</span>
            </template>

            <v-list-item-title class="text-truncate">{{ t.title }}</v-list-item-title>
            <v-list-item-subtitle>
              {{ t.author?.displayName || '' }} &middot; {{ formatDateTime(t.createdAt) }}
            </v-list-item-subtitle>

            <template #append>
              <div class="d-flex align-center" style="gap: 6px">
                <v-chip :color="statusColor(t.status)" size="small" label>
                  {{ formatStatus(t.status) }}
                </v-chip>
                <v-chip :color="priorityColor(t.priority)" size="small" label variant="outlined">
                  {{ formatPriority(t.priority) }}
                </v-chip>
                <v-btn
                  icon="mdi-delete-outline"
                  color="error"
                  variant="text"
                  size="x-small"
                  @click.prevent="deleteTicket(t)"
                />
              </div>
            </template>
          </v-list-item>
        </v-list>
      </v-card>

      <div v-if="totalPages > 1" class="d-flex justify-center mt-4">
        <v-pagination
          v-model="page"
          :length="totalPages"
          :total-visible="7"
          rounded
          @update:model-value="load"
        />
      </div>
    </v-container>
  </AdminLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { api } from '@/services/api.js';
import { toast } from '@/composables/useToast.js';
import { formatDateTime, formatStatus, formatPriority } from '@/utils/format.js';
import AdminLayout from '@/components/layout/AdminLayout.vue';

const tickets = ref([]);
const page = ref(1);
const totalPages = ref(1);
const loading = ref(false);
const filters = reactive({ status: '', priority: '' });

const statusOptions = [
  { value: '', text: 'Все статусы' },
  { value: 'OPEN', text: 'Открытые' },
  { value: 'IN_PROGRESS', text: 'В работе' },
  { value: 'WAITING_FOR_USER', text: 'Ожидают ответа' },
  { value: 'RESOLVED', text: 'Решённые' },
  { value: 'CLOSED', text: 'Закрытые' }
];

const priorityOptions = [
  { value: '', text: 'Все приоритеты' },
  { value: 'LOW', text: 'Низкий' },
  { value: 'MEDIUM', text: 'Средний' },
  { value: 'HIGH', text: 'Высокий' },
  { value: 'CRITICAL', text: 'Критичный' }
];

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

function priorityColor(priority) {
  const map = {
    LOW: 'green',
    MEDIUM: 'blue',
    HIGH: 'orange',
    CRITICAL: 'red'
  };
  return map[priority] || 'grey';
}

async function deleteTicket(t) {
  if (!confirm(`Удалить тикет #${t.number} "${t.title}"? Все сообщения и вложения будут удалены безвозвратно.`)) return;
  try {
    await api.delete(`/admin/tickets/${t.id}`);
    toast.success(`Тикет #${t.number} удалён`);
    await load();
  } catch (err) { toast.error(err.message); }
}

async function load() {
  loading.value = true;
  try {
    const query = { page: page.value, limit: 30, ...filters };
    const res = await api.get('/tickets', query);
    tickets.value = res.data || [];
    if (res.meta?.totalPages) {
      totalPages.value = res.meta.totalPages;
    }
  } catch (err) { toast.error(err.message); }
  loading.value = false;
}

onMounted(load);
</script>
