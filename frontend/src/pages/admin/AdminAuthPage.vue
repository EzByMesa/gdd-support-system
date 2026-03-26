<template>
  <AdminLayout>
    <v-container fluid>
      <div class="d-flex align-center justify-space-between mb-6">
        <div class="text-h5 font-weight-bold">Авторизация</div>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="openModal(null)">
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
        <v-card v-for="p in providers" :key="p.id" variant="outlined" @click="openModal(p)" style="cursor: pointer">
          <v-card-text class="d-flex align-center justify-space-between">
            <div class="d-flex align-center" style="gap: 12px">
              <v-avatar :color="p.type === 'ONE_C' ? 'primary' : 'grey'" size="40" variant="tonal">
                <v-icon :icon="p.type === 'ONE_C' ? 'mdi-cog' : 'mdi-lock-outline'" />
              </v-avatar>
              <div>
                <div class="font-weight-medium">{{ p.name }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ p.type === 'ONE_C' ? 'СервисДеск' : 'Локальный' }}
                </div>
              </div>
            </div>

            <div class="d-flex align-center" style="gap: 8px">
              <v-btn
                :icon="p.isActive ? 'mdi-toggle-switch' : 'mdi-toggle-switch-off-outline'"
                :color="p.isActive ? 'success' : 'grey'"
                variant="text"
                size="small"
                :title="p.isActive ? 'Отключить' : 'Включить'"
                @click.stop="toggleProvider(p)"
              />
              <v-btn
                icon="mdi-pencil-outline"
                variant="text"
                size="small"
                title="Редактировать"
                @click.stop="openModal(p)"
              />
              <v-btn
                icon="mdi-delete-outline"
                color="error"
                variant="text"
                size="small"
                @click.stop="deleteProvider(p)"
              />
            </div>
          </v-card-text>
        </v-card>
      </div>

      <!-- Add / Edit Provider Dialog -->
      <v-dialog v-model="showModal" max-width="580" persistent>
        <v-card>
          <v-card-title class="text-h6">
            {{ isEditing ? 'Редактировать провайдер' : 'Добавить провайдер' }}
          </v-card-title>
          <v-card-text>
            <div class="d-flex flex-column" style="gap: 16px">
              <v-select
                v-model="modalForm.type"
                :items="[{ value: 'ONE_C', title: 'СервисДеск' }]"
                item-title="title"
                item-value="value"
                label="Тип"
                variant="outlined"
                density="compact"
                :disabled="isEditing"
              />
              <v-text-field
                v-model="modalForm.name"
                label="Название"
                variant="outlined"
                density="compact"
                :rules="[v => !!v || 'Обязательное поле']"
                @update:model-value="onConfigChanged"
              />

              <v-divider />

              <div class="text-subtitle-2 font-weight-bold">Настройки подключения</div>

              <v-text-field
                v-model="modalForm.baseUrl"
                label="URL сервера"
                placeholder="http://server:8080/endpoint"
                variant="outlined"
                density="compact"
                :rules="[v => !!v || 'Обязательное поле']"
                @update:model-value="onConfigChanged"
              />
              <v-text-field
                v-model="modalForm.endpoint"
                label="Эндпоинт авторизации"
                variant="outlined"
                density="compact"
                @update:model-value="onConfigChanged"
              />
              <v-text-field
                v-model="modalForm.timeout"
                label="Таймаут (мс)"
                type="number"
                variant="outlined"
                density="compact"
                @update:model-value="onConfigChanged"
              />

              <v-divider />

              <!-- Inline test -->
              <div class="text-subtitle-2 font-weight-bold">Тест подключения</div>
              <p class="text-caption text-medium-emphasis" style="margin-top: -8px">
                Для сохранения необходимо пройти успешный тест
              </p>

              <v-text-field
                v-model="testForm.login"
                label="Логин"
                prepend-inner-icon="mdi-account"
                variant="outlined"
                density="compact"
                hide-details
              />
              <v-text-field
                v-model="testForm.password"
                label="Пароль"
                prepend-inner-icon="mdi-lock"
                variant="outlined"
                density="compact"
                :type="showTestPassword ? 'text' : 'password'"
                :append-inner-icon="showTestPassword ? 'mdi-eye-off' : 'mdi-eye'"
                hide-details
                @click:append-inner="showTestPassword = !showTestPassword"
              />

              <v-btn
                variant="outlined"
                color="primary"
                :loading="testLoading"
                :disabled="!testForm.login || !testForm.password || !modalForm.baseUrl"
                prepend-icon="mdi-connection"
                @click="runInlineTest"
              >
                Проверить подключение
              </v-btn>

              <!-- Test result -->
              <v-alert
                v-if="testResult"
                :type="testResult.success ? 'success' : 'error'"
                variant="tonal"
                density="compact"
              >
                <div class="font-weight-medium">{{ testResult.message }}</div>
                <div v-if="testResult.status" class="text-caption mt-1">
                  HTTP {{ testResult.status }}
                </div>
              </v-alert>

              <!-- JSON response preview -->
              <v-expansion-panels v-if="testResult?.response" variant="accordion">
                <v-expansion-panel title="Ответ сервера (JSON)">
                  <v-expansion-panel-text>
                    <pre class="text-caption" style="overflow-x: auto; white-space: pre-wrap">{{ JSON.stringify(testResult.response, null, 2) }}</pre>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </div>
          </v-card-text>
          <v-card-actions class="px-4 pb-4">
            <v-spacer />
            <v-btn variant="text" @click="showModal = false">Отмена</v-btn>
            <v-btn
              color="primary"
              :loading="saveLoading"
              :disabled="!testPassed"
              @click="saveProvider"
            >
              {{ isEditing ? 'Сохранить' : 'Добавить' }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </AdminLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '@/services/api.js';
import { toast } from '@/composables/useToast.js';
import AdminLayout from '@/components/layout/AdminLayout.vue';

const providers = ref([]);
const regEnabled = ref(true);

// Modal state
const showModal = ref(false);
const editingId = ref(null);
const isEditing = computed(() => !!editingId.value);
const saveLoading = ref(false);
const testPassed = ref(false);

const modalForm = reactive({
  type: 'ONE_C', name: 'СервисДеск', baseUrl: '', endpoint: '/auth/validate', timeout: '5000'
});

// Inline test
const showTestPassword = ref(false);
const testLoading = ref(false);
const testResult = ref(null);
const testForm = reactive({ login: '', password: '' });

function resetModal() {
  modalForm.type = 'ONE_C';
  modalForm.name = 'СервисДеск';
  modalForm.baseUrl = '';
  modalForm.endpoint = '/auth/validate';
  modalForm.timeout = '5000';
  testForm.login = '';
  testForm.password = '';
  testResult.value = null;
  testPassed.value = false;
  showTestPassword.value = false;
  editingId.value = null;
}

function openModal(provider) {
  resetModal();
  if (provider) {
    editingId.value = provider.id;
    modalForm.type = provider.type;
    modalForm.name = provider.name;
    modalForm.baseUrl = provider.config?.baseUrl || '';
    modalForm.endpoint = provider.config?.authEndpoint || '/auth/validate';
    modalForm.timeout = String(provider.config?.timeout || 5000);
  }
  showModal.value = true;
}

function onConfigChanged() {
  // Сброс теста при изменении настроек подключения
  testPassed.value = false;
  testResult.value = null;
}

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

async function runInlineTest() {
  testLoading.value = true;
  testResult.value = null;
  testPassed.value = false;

  // Для inline-теста: если провайдер ещё не создан, тестируем напрямую через временный endpoint
  // Если редактируем существующий — используем его id
  try {
    if (isEditing.value) {
      // Сначала сохраняем config без коммита (через PUT), потом тестируем
      await api.put(`/admin/auth-providers/${editingId.value}`, {
        name: modalForm.name,
        config: {
          baseUrl: modalForm.baseUrl,
          authEndpoint: modalForm.endpoint,
          timeout: parseInt(modalForm.timeout) || 5000,
          defaultRole: 'USER'
        }
      });
      const res = await api.post(`/admin/auth-providers/${editingId.value}/test`, {
        login: testForm.login,
        password: testForm.password
      });
      testResult.value = res.data;
    } else {
      // Для нового провайдера: создаём неактивным, тестируем, если не прошёл — удаляем
      const created = await api.post('/admin/auth-providers', {
        type: 'ONE_C',
        name: modalForm.name,
        isActive: false,
        config: {
          baseUrl: modalForm.baseUrl,
          authEndpoint: modalForm.endpoint,
          timeout: parseInt(modalForm.timeout) || 5000,
          defaultRole: 'USER'
        }
      });
      const tempId = created.data.id;
      editingId.value = tempId; // теперь работаем как с существующим

      const res = await api.post(`/admin/auth-providers/${tempId}/test`, {
        login: testForm.login,
        password: testForm.password
      });
      testResult.value = res.data;

      if (!res.data.success) {
        // Тест не прошёл — удаляем временный провайдер
        await api.delete(`/admin/auth-providers/${tempId}`);
        editingId.value = null;
      }
    }

    testPassed.value = !!testResult.value?.success;
  } catch (err) {
    testResult.value = { success: false, message: err.message };
    testPassed.value = false;
  }
  testLoading.value = false;
}

async function saveProvider() {
  saveLoading.value = true;
  try {
    // Провайдер уже существует (создан при тесте или редактируется)
    await api.put(`/admin/auth-providers/${editingId.value}`, {
      name: modalForm.name,
      isActive: true,
      config: {
        baseUrl: modalForm.baseUrl,
        authEndpoint: modalForm.endpoint,
        timeout: parseInt(modalForm.timeout) || 5000,
        defaultRole: 'USER'
      }
    });
    toast.success(isEditing.value ? 'Провайдер сохранён' : 'Провайдер добавлен');
    showModal.value = false;
    await load();
  } catch (err) {
    toast.error(err.message);
  }
  saveLoading.value = false;
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

onMounted(load);
</script>
