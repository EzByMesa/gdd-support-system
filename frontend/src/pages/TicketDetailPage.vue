<template>
  <MainLayout>
    <div v-if="loading" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" size="32" />
    </div>

    <div v-else-if="error" class="text-center py-8">
      <v-icon size="40" color="error" class="mb-2">mdi-alert-circle-outline</v-icon>
      <div class="text-body-2 mb-3">{{ error }}</div>
      <v-btn size="small" variant="text" @click="router.push('/')">Назад</v-btn>
    </div>

    <template v-else-if="ticket">
      <!-- Compact header with inline info -->
      <div class="d-flex align-start mb-3" style="gap: 8px">
        <v-btn icon variant="text" size="small" @click="router.push('/')">
          <v-icon size="18">mdi-arrow-left</v-icon>
        </v-btn>
        <div style="flex: 1; min-width: 0">
          <div class="text-body-1 font-weight-bold">
            <span style="color: rgba(255,255,255,0.3)">#{{ ticket.number }}</span>
            {{ ticket.title }}
          </div>
          <!-- Inline chips - always visible -->
          <div class="d-flex align-center flex-wrap mt-1" style="gap: 4px">
            <v-chip :color="statusColorMap[ticket.status]" size="x-small" label>
              {{ formatStatus(ticket.status) }}
            </v-chip>
            <v-chip :color="priorityColorMap[ticket.priority]" size="x-small" label variant="tonal">
              {{ formatPriority(ticket.priority) }}
            </v-chip>
            <span class="text-caption" style="color: rgba(255,255,255,0.25)">
              {{ ticket.author?.displayName }}
            </span>
            <span v-if="ticket.assignee" class="text-caption" style="color: rgba(255,255,255,0.25)">
              &rarr; {{ ticket.assignee.displayName }}
            </span>
            <v-chip v-if="ticket.createdBy" color="purple" size="x-small" label variant="tonal" prepend-icon="mdi-shield-account">
              Создано: {{ ticket.createdBy.displayName }}
            </v-chip>
            <v-chip v-if="ticket.readonly" color="grey" size="x-small" label prepend-icon="mdi-lock">
              Закрыто
            </v-chip>
          </div>
        </div>
      </div>

      <!-- Actions bar (agent/user) - compact, always accessible -->
      <div v-if="!ticket.readonly && (hasActions || canUserClose)" class="mb-3">
        <div class="d-flex flex-wrap" style="gap: 6px">
          <!-- Автор не может взять свой тикет -->
          <v-chip v-if="isStaff && ticket.status === 'OPEN' && ticket.author?.id === user.id"
            color="warning" variant="tonal" size="small" prepend-icon="mdi-information-outline">
            Вы автор — назначить может другой агент
          </v-chip>
          <v-btn v-else-if="isStaff && ticket.status === 'OPEN'" color="primary" size="small"
            :loading="actionLoading" @click="assignTicket" prepend-icon="mdi-hand-back-right">
            Взять в работу
          </v-btn>

          <template v-if="isStaff && (ticket.assignee?.id === user.id || user.role === 'SENIOR_AGENT' || user.role === 'ADMIN')">
            <v-btn v-for="s in statusButtons" :key="s.value" size="small"
              :color="ticket.status === s.value ? s.color : undefined"
              :variant="ticket.status === s.value ? 'flat' : 'outlined'"
              :disabled="ticket.status === s.value" @click="updateStatus(s.value)">
              {{ s.text }}
            </v-btn>
            <v-btn size="small" color="surface-light" prepend-icon="mdi-swap-horizontal"
              @click="showDelegateModal = true">
              Делегировать
            </v-btn>
          </template>

          <v-btn v-if="canUserClose" size="small" variant="text" color="error"
            prepend-icon="mdi-close-circle-outline" @click="showCloseModal = true">
            Закрыть
          </v-btn>

        </div>
      </div>

      <!-- Knowledge button for closed tickets (outside readonly guard) -->
      <div v-if="authStore.knowledgeEnabled && isStaff && ticket.readonly && (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED')" class="mb-3">
        <v-btn size="small" variant="tonal" color="info" prepend-icon="mdi-book-plus"
          :loading="convertingToKb" @click="convertToKnowledge">
          Добавить в базу знаний
        </v-btn>
      </div>

      <!-- Main content -->
      <v-row dense>
        <v-col cols="12" md="8" order="1" order-md="1">
          <!-- Description -->
          <v-card class="mb-3" color="surface-light">
            <v-card-text class="pa-3">
              <div class="text-caption font-weight-bold mb-1" style="color: rgba(255,255,255,0.35)">Описание</div>
              <div class="text-body-2" style="white-space: pre-wrap; line-height: 1.5">{{ ticket.description }}</div>
              <template v-if="ticket.attachments?.length">
                <v-divider class="my-2" />
                <div v-for="att in ticket.attachments" :key="att.id">
                  <a :href="`${config.apiUrl}/attachments/${att.id}/download`" target="_blank"
                    class="d-flex align-center text-decoration-none text-primary" style="gap: 4px; font-size: 0.8rem">
                    <v-icon size="14">mdi-paperclip</v-icon>
                    {{ att.originalName }} ({{ formatFileSize(att.size) }})
                  </a>
                </div>
              </template>
            </v-card-text>
          </v-card>

          <!-- Chat -->
          <div class="text-caption font-weight-bold mb-1" style="color: rgba(255,255,255,0.35)">Чат</div>
          <ChatWindow v-if="canViewChat" :ticket-id="ticketId" :current-user-id="user.id"
            :readonly="!canChat || ticket.readonly"
            @ticket-updated="loadTicket" />
        </v-col>

        <!-- Sidebar: details (on mobile appears second, below actions but above chat would be confusing, so after) -->
        <v-col cols="12" md="4" order="2" order-md="2">
          <v-card color="surface-light">
            <v-card-text class="pa-3">
              <div class="text-caption font-weight-bold mb-2" style="color: rgba(255,255,255,0.35)">Детали</div>
              <div class="d-flex flex-column" style="gap: 6px">
                <div class="d-flex justify-space-between align-center">
                  <span class="text-caption" style="color: rgba(255,255,255,0.3)">Создано</span>
                  <span class="text-caption">{{ formatDateTime(ticket.createdAt) }}</span>
                </div>
                <div v-if="ticket.updatedAt !== ticket.createdAt" class="d-flex justify-space-between align-center">
                  <span class="text-caption" style="color: rgba(255,255,255,0.3)">Обновлено</span>
                  <span class="text-caption">{{ formatDateTime(ticket.updatedAt) }}</span>
                </div>
                <div v-if="ticket.closedAt" class="d-flex justify-space-between align-center">
                  <span class="text-caption" style="color: rgba(255,255,255,0.3)">Закрыто</span>
                  <span class="text-caption">{{ formatDateTime(ticket.closedAt) }}</span>
                </div>
                <div v-if="ticket.closedReason">
                  <span class="text-caption" style="color: rgba(255,255,255,0.3)">Причина:</span>
                  <div class="text-caption mt-1" style="white-space: pre-wrap">{{ ticket.closedReason }}</div>
                </div>

                <!-- Custom Fields -->
                <template v-for="cf in customFieldDefs" :key="cf.fieldKey">
                  <div v-if="ticket.customFields?.[cf.fieldKey] != null && ticket.customFields[cf.fieldKey] !== ''"
                    class="d-flex justify-space-between align-center">
                    <span class="text-caption" style="color: rgba(255,255,255,0.3)">{{ cf.name }}</span>
                    <span class="text-caption">
                      {{ cf.type === 'checkbox' ? (ticket.customFields[cf.fieldKey] ? 'Да' : 'Нет') : ticket.customFields[cf.fieldKey] }}
                    </span>
                  </div>
                </template>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <DelegateModal v-if="showDelegateModal" :ticket-id="ticketId"
        @close="showDelegateModal = false" @delegated="loadTicket" />

      <v-dialog v-model="showCloseModal" max-width="440" persistent>
        <v-card color="surface-light">
          <v-card-title class="text-body-1 font-weight-bold">Закрыть обращение</v-card-title>
          <v-card-text>
            <v-textarea v-model="closeReason" label="Причина закрытия" placeholder="Опишите причину..." rows="3" />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" size="small" @click="showCloseModal = false">Отмена</v-btn>
            <v-btn color="error" size="small" :loading="closeLoading" :disabled="!closeReason.trim()"
              @click="handleCloseTicket">Закрыть</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </template>
  </MainLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { api } from '@/services/api.js';
import { toast } from '@/composables/useToast.js';
import { formatDateTime, formatStatus, formatPriority, formatFileSize } from '@/utils/format.js';
import MainLayout from '@/components/layout/MainLayout.vue';
import ChatWindow from '@/components/chat/ChatWindow.vue';
import DelegateModal from '@/components/tickets/DelegateModal.vue';
import config from '@/config.js';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const ticketId = route.params.id;
const ticket = ref(null);
const loading = ref(true);
const error = ref('');
const actionLoading = ref(false);
const showDelegateModal = ref(false);
const showCloseModal = ref(false);
const customFieldDefs = ref([]);
const closeReason = ref('');
const closeLoading = ref(false);
const convertingToKb = ref(false);

const user = computed(() => authStore.user);

const statusColorMap = { OPEN: 'info', IN_PROGRESS: 'warning', WAITING_FOR_USER: 'orange', RESOLVED: 'success', CLOSED: 'grey' };
const priorityColorMap = { LOW: 'grey', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'error' };

const isStaff = computed(() => ['AGENT', 'SENIOR_AGENT', 'ADMIN'].includes(user.value?.role));

// Может читать чат
const canViewChat = computed(() => {
  if (!ticket.value || !user.value) return false;
  if (isStaff.value) return true;
  return user.value.role === 'USER' && ticket.value.author?.id === user.value.id;
});

// Может писать в чат
const canChat = computed(() => {
  if (!ticket.value || !user.value) return false;
  const t = ticket.value;
  return user.value.role === 'ADMIN' || user.value.role === 'SENIOR_AGENT'
    || (user.value.role === 'USER' && t.author?.id === user.value.id)
    || (user.value.role === 'AGENT' && t.assignee?.id === user.value.id);
});

const canUserClose = computed(() => {
  if (!ticket.value || !user.value) return false;
  return user.value.role === 'USER' && ticket.value.author?.id === user.value.id && ticket.value.status !== 'CLOSED';
});

const hasActions = computed(() => {
  if (!ticket.value || !user.value) return false;
  const t = ticket.value;
  return (isStaff.value && t.status === 'OPEN') || (isStaff.value && t.assignee?.id === user.value.id);
});

const statusButtons = [
  { value: 'IN_PROGRESS', text: 'В работе', color: 'warning' },
  { value: 'WAITING_FOR_USER', text: 'Ожидает', color: 'orange' },
  { value: 'RESOLVED', text: 'Решён', color: 'success' },
  { value: 'CLOSED', text: 'Закрыт', color: 'grey' }
];

async function loadTicket() {
  const isFirstLoad = !ticket.value;
  if (isFirstLoad) loading.value = true;
  error.value = '';
  try {
    const res = await api.get(`/tickets/${ticketId}`);
    ticket.value = res.data;
  } catch (err) { error.value = err.message; }
  if (isFirstLoad) loading.value = false;
}

async function assignTicket() {
  actionLoading.value = true;
  try {
    const res = await api.put(`/tickets/${ticketId}/assign`);
    ticket.value = res.data;
    toast.success('Тикет взят в работу!');
  } catch (err) { toast.error(err.message); }
  actionLoading.value = false;
}

async function updateStatus(status) {
  try {
    const res = await api.put(`/tickets/${ticketId}/status`, { status });
    ticket.value = res.data;
    toast.success(`Статус: ${formatStatus(status)}`);
  } catch (err) { toast.error(err.message); }
}

async function handleCloseTicket() {
  closeLoading.value = true;
  try {
    const res = await api.put(`/tickets/${ticketId}/close`, { reason: closeReason.value });
    ticket.value = res.data;
    showCloseModal.value = false;
    closeReason.value = '';
    toast.success('Обращение закрыто');
  } catch (err) { toast.error(err.message); }
  closeLoading.value = false;
}

async function convertToKnowledge() {
  convertingToKb.value = true;
  try {
    const res = await api.post(`/knowledge/from-ticket/${ticketId}`);
    toast.success('Черновик создан — отредактируйте и опубликуйте');
    router.push(`/admin/knowledge?edit=${res.data.id}`);
  } catch (err) { toast.error(err.message); }
  convertingToKb.value = false;
}

async function loadCustomFields() {
  try {
    const res = await api.get('/tickets/custom-fields');
    customFieldDefs.value = res.data || [];
  } catch { /* */ }
}

onMounted(() => { loadTicket(); loadCustomFields(); });
</script>
