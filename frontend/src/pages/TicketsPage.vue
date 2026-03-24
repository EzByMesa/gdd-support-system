<template>
  <MainLayout>
    <!-- Compact header -->
    <div class="d-flex align-center justify-space-between mb-3">
      <span class="text-body-1 font-weight-bold">Обращения</span>
      <v-btn color="primary" size="small" prepend-icon="mdi-plus" @click="router.push('/tickets/new')">
        Новое
      </v-btn>
    </div>

    <!-- Scrollable tabs -->
    <v-tabs v-model="statusFilter" class="mb-3" color="primary" density="compact"
      show-arrows @update:model-value="onTabChange">
      <v-tab v-for="tab in statusTabs" :key="tab.value" :value="tab.value" size="small">
        {{ tab.label }}
      </v-tab>
    </v-tabs>

    <!-- Loading -->
    <div v-if="loading" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" size="32" />
    </div>

    <!-- Empty -->
    <div v-else-if="tickets.length === 0" class="text-center py-8">
      <v-icon size="40" style="opacity: 0.2" class="mb-2">mdi-ticket-outline</v-icon>
      <div class="text-body-2" style="color: rgba(255,255,255,0.3)">
        {{ statusFilter ? 'Нет обращений с этим статусом' : 'Создайте первое обращение' }}
      </div>
    </div>

    <!-- Ticket list - compact cards -->
    <template v-else>
      <v-card v-for="ticket in tickets" :key="ticket.id" class="mb-2 ticket-card-hover"
        color="surface-light" @click="router.push(`/tickets/${ticket.id}`)">
        <div class="d-flex align-center pa-3" style="gap: 10px">
          <!-- Number -->
          <span class="text-caption font-weight-bold" style="color: rgba(255,255,255,0.3); min-width: 32px">#{{ ticket.number }}</span>

          <!-- Content -->
          <div style="flex: 1; min-width: 0">
            <div class="text-body-2 font-weight-medium text-truncate">{{ ticket.title }}</div>
            <div class="d-flex align-center flex-wrap mt-1" style="gap: 4px">
              <v-chip :color="statusColor(ticket.status)" size="x-small" label>
                {{ formatStatus(ticket.status) }}
              </v-chip>
              <v-chip :color="priorityColor(ticket.priority)" size="x-small" label variant="tonal">
                {{ formatPriority(ticket.priority) }}
              </v-chip>
              <span class="text-caption" style="color: rgba(255,255,255,0.25)">
                {{ formatShortDate(ticket.createdAt) }}
              </span>
              <span v-if="ticket.assignee" class="text-caption" style="color: rgba(255,255,255,0.25)">
                &middot; {{ ticket.assignee.displayName }}
              </span>
            </div>
          </div>

          <v-icon size="16" style="opacity: 0.15">mdi-chevron-right</v-icon>
        </div>
      </v-card>
    </template>

    <!-- Pagination -->
    <div v-if="pagination && pagination.totalPages > 1" class="d-flex justify-center mt-3">
      <v-pagination v-model="page" :length="pagination.totalPages" :total-visible="5"
        density="compact" size="small" rounded="circle" @update:model-value="loadTickets" />
    </div>
  </MainLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/services/api.js';
import { toast } from '@/composables/useToast.js';
import { formatStatus, formatPriority } from '@/utils/format.js';
import MainLayout from '@/components/layout/MainLayout.vue';

const router = useRouter();

const statusTabs = [
  { value: '', label: 'Все' },
  { value: 'OPEN', label: 'Открыт' },
  { value: 'IN_PROGRESS', label: 'В работе' },
  { value: 'WAITING_FOR_USER', label: 'Ожидает' },
  { value: 'RESOLVED', label: 'Решён' },
  { value: 'CLOSED', label: 'Закрыт' }
];

const STATUS_COLORS = { OPEN: 'info', IN_PROGRESS: 'warning', WAITING_FOR_USER: 'orange', RESOLVED: 'success', CLOSED: 'grey' };
const PRIORITY_COLORS = { LOW: 'grey', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'error' };
function statusColor(s) { return STATUS_COLORS[s] || 'grey'; }
function priorityColor(p) { return PRIORITY_COLORS[p] || 'grey'; }

function formatShortDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  const now = new Date();
  if (dt.toDateString() === now.toDateString()) {
    return dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

const statusFilter = ref('');
const tickets = ref([]);
const pagination = ref(null);
const page = ref(1);
const loading = ref(false);

function onTabChange() { page.value = 1; loadTickets(); }

async function loadTickets() {
  loading.value = true;
  try {
    const query = { page: page.value, limit: 20 };
    if (statusFilter.value) query.status = statusFilter.value;
    const res = await api.get('/tickets', query);
    tickets.value = res.data;
    pagination.value = res.pagination;
  } catch (err) { toast.error(err.message || 'Ошибка загрузки'); }
  loading.value = false;
}

onMounted(loadTickets);
</script>
