<template>
  <MainLayout>
    <!-- Header + Search + New -->
    <div class="d-flex align-center mb-4" style="gap: 12px">
      <v-text-field
        v-model="searchQuery"
        placeholder="Поиск по обращениям..."
        prepend-inner-icon="mdi-magnify"
        variant="solo-filled"
        density="default"
        hide-details
        clearable
        flat
        rounded="xl"
        style="flex: 1"
        @update:model-value="debouncedSearch"
      />
      <v-btn color="primary" prepend-icon="mdi-plus" rounded="xl" @click="router.push('/tickets/new')">
        Новое
      </v-btn>
    </div>

    <!-- Filters -->
    <div class="d-flex align-center flex-wrap mb-4" style="gap: 8px">
      <v-chip v-for="s in statusOptions" :key="s.value"
        :color="statusFilter === s.value ? 'primary' : undefined"
        :variant="statusFilter === s.value ? 'flat' : 'tonal'"
        rounded="xl"
        @click="statusFilter = s.value; resetAndLoad()">
        {{ s.text }}
      </v-chip>

      <v-spacer />

      <v-menu>
        <template #activator="{ props }">
          <v-chip v-bind="props" variant="tonal" rounded="xl" append-icon="mdi-chevron-down">
            {{ currentPriorityLabel }}
          </v-chip>
        </template>
        <v-list density="compact" rounded="lg">
          <v-list-item v-for="p in priorityOptions" :key="p.value" :title="p.text" rounded="lg"
            @click="priorityFilter = p.value; resetAndLoad()" />
        </v-list>
      </v-menu>

      <v-menu>
        <template #activator="{ props }">
          <v-chip v-bind="props" variant="tonal" rounded="xl" prepend-icon="mdi-sort" append-icon="mdi-chevron-down">
            {{ currentSortLabel }}
          </v-chip>
        </template>
        <v-list density="compact" rounded="lg">
          <v-list-item v-for="s in sortOptions" :key="s.value" :title="s.text" rounded="lg"
            @click="sortBy = s.value; resetAndLoad()" />
        </v-list>
      </v-menu>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" size="32" />
    </div>

    <!-- Empty -->
    <div v-else-if="tickets.length === 0" class="text-center py-8">
      <v-icon size="40" style="opacity: 0.2" class="mb-2">mdi-ticket-outline</v-icon>
      <div class="text-body-2" style="color: rgba(255,255,255,0.3)">
        {{ searchQuery || statusFilter || priorityFilter ? 'Ничего не найдено' : 'Создайте первое обращение' }}
      </div>
    </div>

    <!-- Ticket list -->
    <template v-else>
      <!-- AGENT/ADMIN: grouped view -->
      <template v-if="isStaff">
        <template v-if="myTickets.length">
          <div class="text-caption font-weight-bold mb-2" style="color: rgba(255,255,255,0.4)">
            Мои тикеты ({{ myTickets.length }})
          </div>
          <TicketCard v-for="t in myTickets" :key="t.id" :ticket="t" show-author
            @click="router.push(`/tickets/${t.id}`)" />
        </template>

        <v-divider v-if="myTickets.length && otherTickets.length" class="my-3" />

        <template v-if="otherTickets.length">
          <div class="text-caption font-weight-bold mb-2" style="color: rgba(255,255,255,0.4)">
            Остальные ({{ otherTickets.length }})
          </div>
          <TicketCard v-for="t in otherTickets" :key="t.id" :ticket="t" show-author
            @click="router.push(`/tickets/${t.id}`)" />
        </template>
      </template>

      <!-- USER: flat list -->
      <template v-else>
        <TicketCard v-for="t in tickets" :key="t.id" :ticket="t"
          @click="router.push(`/tickets/${t.id}`)" />
      </template>
    </template>

    <!-- Pagination -->
    <div v-if="pagination && pagination.totalPages > 1" class="d-flex justify-center mt-3">
      <v-pagination v-model="page" :length="pagination.totalPages" :total-visible="5"
        density="compact" size="small" rounded="circle" @update:model-value="loadTickets" />
    </div>
  </MainLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { useNotificationStore } from '@/stores/notifications.js';
import { api } from '@/services/api.js';
import { toast } from '@/composables/useToast.js';
import MainLayout from '@/components/layout/MainLayout.vue';
import TicketCard from '@/components/tickets/TicketCard.vue';

const router = useRouter();
const authStore = useAuthStore();
const notifStore = useNotificationStore();

const statusOptions = [
  { value: '', text: 'Все статусы' },
  { value: 'OPEN', text: 'Открыт' },
  { value: 'IN_PROGRESS', text: 'В работе' },
  { value: 'WAITING_FOR_USER', text: 'Ожидает' },
  { value: 'RESOLVED', text: 'Решён' },
  { value: 'CLOSED', text: 'Закрыт' }
];
const priorityOptions = [
  { value: '', text: 'Все приоритеты' },
  { value: 'LOW', text: 'Низкий' },
  { value: 'MEDIUM', text: 'Средний' },
  { value: 'HIGH', text: 'Высокий' },
  { value: 'CRITICAL', text: 'Критичный' }
];

const sortOptions = [
  { value: 'createdAt:DESC', text: 'Сначала новые' },
  { value: 'createdAt:ASC', text: 'Сначала старые' },
  { value: 'updatedAt:DESC', text: 'По обновлению' },
  { value: 'priority:DESC', text: 'По приоритету' },
  { value: 'number:ASC', text: 'По номеру' }
];

const searchQuery = ref('');
const statusFilter = ref('');
const priorityFilter = ref('');
const sortBy = ref('createdAt:DESC');
const tickets = ref([]);
const pagination = ref(null);
const page = ref(1);
const loading = ref(false);

const isStaff = computed(() => ['AGENT', 'SENIOR_AGENT', 'ADMIN'].includes(authStore.user?.role));
const currentPriorityLabel = computed(() => priorityOptions.find(p => p.value === priorityFilter.value)?.text || 'Приоритет');
const currentSortLabel = computed(() => sortOptions.find(s => s.value === sortBy.value)?.text || 'Сортировка');
const myTickets = computed(() => tickets.value.filter(t => t.assignee?.id === authStore.user?.id));
const otherTickets = computed(() => tickets.value.filter(t => t.assignee?.id !== authStore.user?.id));

// Auto-refresh on WS event
watch(() => notifStore.ticketsUpdatedAt, (val) => {
  if (val) loadTickets();
});

let searchTimer = null;
function debouncedSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { page.value = 1; loadTickets(); }, 300);
}

function resetAndLoad() { page.value = 1; loadTickets(); }

async function loadTickets() {
  loading.value = true;
  try {
    const [sort, sortDir] = sortBy.value.split(':');
    const query = { page: page.value, limit: 20, sort, sortDir };
    if (searchQuery.value) query.search = searchQuery.value;
    if (statusFilter.value) query.status = statusFilter.value;
    if (priorityFilter.value) query.priority = priorityFilter.value;
    const res = await api.get('/tickets', query);
    tickets.value = res.data;
    pagination.value = res.pagination;
  } catch (err) { toast.error(err.message || 'Ошибка загрузки'); }
  loading.value = false;
}

onMounted(loadTickets);
</script>
