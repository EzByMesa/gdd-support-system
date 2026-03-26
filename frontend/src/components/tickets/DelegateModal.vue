<template>
  <v-dialog :model-value="true" max-width="480" persistent @update:model-value="$emit('close')">
    <v-card>
      <v-card-title class="text-body-1 font-weight-bold">Делегировать тикет</v-card-title>
      <v-card-text>
        <div v-if="loading" class="d-flex justify-center py-4">
          <v-progress-circular indeterminate color="primary" size="32" />
        </div>

        <v-alert v-else-if="agentOptions.length === 0" type="info" variant="tonal">
          Нет доступных агентов для делегирования
        </v-alert>

        <template v-else>
          <v-select
            v-model="selectedAgent"
            :items="agentOptions"
            item-title="text"
            item-value="value"
            label="Выберите агента"
            variant="outlined"
            density="compact"
            class="mb-3"
          />
          <v-textarea
            v-model="reason"
            label="Причина (необязательно)"
            placeholder="Почему вы хотите передать этот тикет?"
            variant="outlined"
            density="compact"
            rows="3"
          />
        </template>
      </v-card-text>
      <v-card-actions class="px-4 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="$emit('close')">Отмена</v-btn>
        <v-btn
          v-if="agentOptions.length > 0"
          color="primary"
          :loading="submitting"
          :disabled="!selectedAgent"
          @click="submit"
        >
          Отправить запрос
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '@/services/api.js';
import { useAuthStore } from '@/stores/auth.js';
import { toast } from '@/composables/useToast.js';

const props = defineProps({
  ticketId: { type: String, required: true }
});

const emit = defineEmits(['close', 'delegated']);

const authStore = useAuthStore();
const loading = ref(true);
const submitting = ref(false);
const agents = ref([]);
const selectedAgent = ref(null);
const reason = ref('');

const agentOptions = computed(() =>
  agents.value
    .filter(a => a.id !== authStore.user.id)
    .map(a => ({
      value: a.id,
      text: `${a.displayName} (${a.role === 'ADMIN' ? 'Администратор' : 'Агент'})`
    }))
);

async function loadAgents() {
  try {
    const res = await api.get('/admin/users', { limit: 100 });
    agents.value = (res.data || []).filter(u =>
      (u.role === 'AGENT' || u.role === 'ADMIN') && u.isActive
    );
  } catch {
    agents.value = [];
  }
  loading.value = false;
}

async function submit() {
  if (!selectedAgent.value) {
    toast.warning('Выберите агента');
    return;
  }
  submitting.value = true;
  try {
    await api.post(`/tickets/${props.ticketId}/delegate`, {
      toAgentId: selectedAgent.value,
      message: reason.value.trim() || null
    });
    toast.success('Запрос на делегирование отправлен');
    emit('delegated');
    emit('close');
  } catch (err) {
    toast.error(err.message || 'Ошибка делегирования');
    submitting.value = false;
  }
}

onMounted(loadAgents);
</script>
