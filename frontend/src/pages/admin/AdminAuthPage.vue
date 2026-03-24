<template>
  <AdminLayout>
    <v-container fluid>
      <div class="d-flex align-center justify-space-between mb-6">
        <div class="text-h5 font-weight-bold">Авторизация</div>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="showAddModal = true">
          Добавить провайдер
        </v-btn>
      </div>

      <!-- Registration toggle -->
      <v-card variant="outlined" class="mb-6">
        <v-card-title class="text-subtitle-1 font-weight-bold">Регистрация</v-card-title>
        <v-card-text>
          <div class="d-flex align-center justify-space-between">
            <div>
              <div class="font-weight-medium">Самостоятельная регистрация</div>
              <div class="text-body-2 text-medium-emphasis">
                Если выключено — только админ может создавать пользователей
              </div>
            </div>
            <v-switch
              v-model="regEnabled"
              color="primary"
              hide-details
              inset
              @update:model-value="toggleRegistration"
            />
          </div>
        </v-card-text>
      </v-card>

      <div class="text-h6 mb-4">Провайдеры авторизации</div>

      <v-alert v-if="providers.length === 0" type="info" variant="tonal" class="mb-4">
        Нет настроенных провайдеров (используется локальная авторизация)
      </v-alert>

      <div v-else class="d-flex flex-column" style="gap: 8px">
        <v-card v-for="p in providers" :key="p.id" variant="outlined">
          <v-card-text class="d-flex align-center justify-space-between">
            <div class="d-flex align-center" style="gap: 12px">
              <v-avatar color="primary" size="40" variant="tonal">
                <span class="font-weight-bold">{{ p.type === 'ONE_C' ? '1С' : '' }}</span>
                <v-icon v-if="p.type !== 'ONE_C'" icon="mdi-lock-outline" />
              </v-avatar>
              <div>
                <div class="font-weight-medium">{{ p.name }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ p.type === 'ONE_C' ? '1С:Предприятие' : 'Локальный' }}
                </div>
              </div>
            </div>

            <div class="d-flex align-center" style="gap: 8px">
              <v-btn
                v-if="p.type === 'ONE_C'"
                variant="outlined"
                size="small"
                prepend-icon="mdi-connection"
                @click="testProvider(p.id)"
              >
                Тест
              </v-btn>
              <v-btn
                :icon="p.isActive ? 'mdi-toggle-switch' : 'mdi-toggle-switch-off-outline'"
                :color="p.isActive ? 'success' : 'grey'"
                variant="text"
                size="small"
                :title="p.isActive ? 'Отключить' : 'Включить'"
                @click="toggleProvider(p)"
              />
              <v-btn
                icon="mdi-delete-outline"
                color="error"
                variant="text"
                size="small"
                @click="deleteProvider(p)"
              />
            </div>
          </v-card-text>
        </v-card>
      </div>

      <!-- Add Provider Dialog -->
      <v-dialog v-model="showAddModal" max-width="550" persistent>
        <v-card>
          <v-card-title class="text-h6">Добавить провайдер</v-card-title>
          <v-card-text>
            <div class="d-flex flex-column" style="gap: 16px">
              <v-select
                v-model="addForm.type"
                :items="[{ value: 'ONE_C', title: '1С:Предприятие' }]"
                item-title="title"
                item-value="value"
                label="Тип"
                variant="outlined"
                density="compact"
              />
              <v-text-field
                v-model="addForm.name"
                label="Название"
                variant="outlined"
                density="compact"
                :rules="[v => !!v || 'Обязательное поле']"
              />

              <v-divider />

              <div class="text-subtitle-2 font-weight-bold">Настройки подключения к 1С</div>

              <v-text-field
                v-model="addForm.baseUrl"
                label="URL сервера 1С"
                placeholder="http://1c-server:8080/erp"
                variant="outlined"
                density="compact"
                :rules="[v => !!v || 'Обязательное поле']"
              />
              <v-text-field
                v-model="addForm.endpoint"
                label="Эндпоинт авторизации"
                variant="outlined"
                density="compact"
              />
              <v-text-field
                v-model="addForm.timeout"
                label="Таймаут (мс)"
                type="number"
                variant="outlined"
                density="compact"
              />
            </div>
          </v-card-text>
          <v-card-actions class="px-4 pb-4">
            <v-spacer />
            <v-btn variant="text" @click="showAddModal = false">Отмена</v-btn>
            <v-btn color="primary" :loading="addLoading" @click="addProvider">Добавить</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </AdminLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { api } from '@/services/api.js';
import { toast } from '@/composables/useToast.js';
import AdminLayout from '@/components/layout/AdminLayout.vue';

const providers = ref([]);
const regEnabled = ref(true);
const showAddModal = ref(false);
const addLoading = ref(false);

const addForm = reactive({
  type: 'ONE_C', name: '1С:Предприятие', baseUrl: '', endpoint: '/auth/validate', timeout: '5000'
});

async function load() {
  try {
    const settings = await api.get('/admin/settings');
    regEnabled.value = settings.data['registration.enabled'] !== false;
  } catch { /* silent */ }

  try {
    const res = await api.get('/admin/auth-providers');
    providers.value = res.data || [];
  } catch (err) { toast.error(err.message); }
}

async function toggleRegistration() {
  await api.put('/admin/settings/registration.enabled', { value: regEnabled.value });
  toast.success(regEnabled.value ? 'Регистрация включена' : 'Регистрация отключена');
}

async function testProvider(id) {
  const res = await api.post(`/admin/auth-providers/${id}/test`);
  if (res.data.success) toast.success(res.data.message);
  else toast.error(res.data.message);
}

async function toggleProvider(p) {
  await api.put(`/admin/auth-providers/${p.id}`, { isActive: !p.isActive });
  toast.success(p.isActive ? 'Отключён' : 'Включён');
  await load();
}

async function deleteProvider(p) {
  if (confirm('Удалить провайдер?')) {
    await api.delete(`/admin/auth-providers/${p.id}`);
    toast.success('Удалён');
    await load();
  }
}

async function addProvider() {
  addLoading.value = true;
  try {
    await api.post('/admin/auth-providers', {
      type: 'ONE_C',
      name: addForm.name,
      config: {
        baseUrl: addForm.baseUrl,
        authEndpoint: addForm.endpoint,
        timeout: parseInt(addForm.timeout) || 5000,
        defaultRole: 'USER'
      }
    });
    toast.success('Провайдер добавлен');
    showAddModal.value = false;
    await load();
  } catch (err) {
    toast.error(err.message);
  }
  addLoading.value = false;
}

onMounted(load);
</script>
