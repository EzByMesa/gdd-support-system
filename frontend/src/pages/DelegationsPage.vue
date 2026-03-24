<template>
  <MainLayout>
    <!-- Page header -->
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h5 font-weight-bold">Делегирование</h1>
      <v-btn variant="text" prepend-icon="mdi-arrow-left" @click="router.push('/')">
        Назад
      </v-btn>
    </div>

    <!-- Tabs -->
    <v-tabs v-model="tab" class="mb-4" color="primary" @update:model-value="load">
      <v-tab value="incoming">
        <v-icon start>mdi-inbox-arrow-down</v-icon>
        Входящие
      </v-tab>
      <v-tab value="outgoing">
        <v-icon start>mdi-inbox-arrow-up</v-icon>
        Исходящие
      </v-tab>
    </v-tabs>

    <!-- Loading -->
    <div v-if="loading" class="d-flex justify-center py-10">
      <v-progress-circular indeterminate color="primary" size="48" />
    </div>

    <!-- Empty state -->
    <v-card v-else-if="items.length === 0" variant="flat" class="pa-10 text-center">
      <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-swap-horizontal</v-icon>
      <div class="text-h6 text-grey mb-2">Нет запросов</div>
      <div class="text-body-2 text-grey">
        {{ tab === 'incoming' ? 'Нет входящих запросов на делегирование' : 'Вы не отправляли запросов' }}
      </div>
    </v-card>

    <!-- Delegation list -->
    <template v-else>
      <v-card v-for="item in items" :key="item.id" class="mb-3" variant="outlined">
        <v-card-text>
          <div class="d-flex align-center justify-space-between flex-wrap ga-2 mb-2">
            <router-link
              :to="`/tickets/${item.ticket?.id}`"
              class="text-subtitle-2 font-weight-bold text-primary text-decoration-none"
            >
              #{{ item.ticket?.number }} {{ item.ticket?.title || '' }}
            </router-link>
            <v-chip
              :color="statusColorMap[item.status]"
              size="small"
              label
            >
              {{ statusLabelMap[item.status] || item.status }}
            </v-chip>
          </div>

          <div class="text-body-2 text-grey mb-2">
            {{ tab === 'incoming'
              ? `От: ${item.fromAgent?.displayName || '?'}`
              : `Кому: ${item.toAgent?.displayName || '?'}` }}
            &middot; {{ formatDateTime(item.createdAt) }}
          </div>

          <div v-if="item.message" class="text-body-2 font-italic mb-2">
            "{{ item.message }}"
          </div>

          <div v-if="tab === 'incoming' && item.status === 'PENDING'" class="d-flex ga-2 mt-2">
            <v-btn
              color="success"
              size="small"
              :loading="respondLoading === item.id"
              @click="respond(item.id, true)"
            >
              <v-icon start>mdi-check</v-icon>
              Принять
            </v-btn>
            <v-btn
              color="error"
              variant="outlined"
              size="small"
              :loading="respondLoading === item.id"
              @click="respond(item.id, false)"
            >
              <v-icon start>mdi-close</v-icon>
              Отклонить
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </template>
  </MainLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/services/api.js';
import { toast } from '@/composables/useToast.js';
import { formatDateTime } from '@/utils/format.js';
import MainLayout from '@/components/layout/MainLayout.vue';

const router = useRouter();

const tab = ref('incoming');
const items = ref([]);
const loading = ref(false);
const respondLoading = ref(null);

const statusColorMap = { PENDING: 'amber', ACCEPTED: 'green', REJECTED: 'grey' };
const statusLabelMap = { PENDING: 'Ожидает', ACCEPTED: 'Принято', REJECTED: 'Отклонено' };

async function load() {
  loading.value = true;
  try {
    const endpoint = tab.value === 'incoming' ? '/delegations/incoming?status=PENDING' : '/delegations/outgoing';
    const res = await api.get(endpoint);
    items.value = res.data || [];
  } catch (err) {
    toast.error(err.message);
  }
  loading.value = false;
}

async function respond(delegationId, accept) {
  respondLoading.value = delegationId;
  try {
    await api.put(`/delegations/${delegationId}/respond`, { accept });
    toast.success(accept ? 'Тикет принят!' : 'Делегирование отклонено');
    await load();
  } catch (err) {
    toast.error(err.message);
  }
  respondLoading.value = null;
}

onMounted(load);
</script>
