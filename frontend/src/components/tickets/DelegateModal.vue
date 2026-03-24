<template>
  <AppModal title="Делегировать тикет" @close="$emit('close')">
    <AppSpinner v-if="loading" />

    <template v-else-if="agents.length === 0">
      <p class="text-muted text-center">Нет доступных агентов для делегирования</p>
    </template>

    <template v-else>
      <AppSelect v-model="selectedAgent" label="Выберите агента" placeholder="Выберите..."
        :options="agentOptions" />

      <div class="input-group mt-md">
        <label>Причина (необязательно)</label>
        <textarea v-model="reason" class="textarea"
          placeholder="Почему вы хотите передать этот тикет?" rows="3"></textarea>
      </div>
    </template>

    <template #footer>
      <AppButton text="Отмена" variant="secondary" @click="$emit('close')" />
      <AppButton v-if="agents.length > 0" text="Отправить запрос"
        :loading="submitting" @click="submit" />
    </template>
  </AppModal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '@/services/api.js';
import { useAuthStore } from '@/stores/auth.js';
import { toast } from '@/composables/useToast.js';
import AppModal from '@/components/ui/AppModal.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import AppSpinner from '@/components/ui/AppSpinner.vue';

const props = defineProps({
  ticketId: { type: String, required: true }
});

const emit = defineEmits(['close', 'delegated']);

const authStore = useAuthStore();
const loading = ref(true);
const submitting = ref(false);
const agents = ref([]);
const selectedAgent = ref('');
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
    const res = await api.get('/admin/users', { role: 'AGENT', limit: 100 });
    agents.value = res.data || [];
  } catch {
    try {
      const res = await api.get('/admin/users', { limit: 100 });
      agents.value = (res.data || []).filter(u =>
        (u.role === 'AGENT' || u.role === 'ADMIN') && u.id !== authStore.user.id
      );
    } catch {
      agents.value = [];
    }
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
