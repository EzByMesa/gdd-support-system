<template>
  <AdminLayout>
    <v-container fluid>
      <v-row v-if="loading" justify="center" class="my-10">
        <v-progress-circular indeterminate color="primary" size="48" />
      </v-row>

      <template v-else>
        <div class="text-h5 font-weight-bold mb-6">Системные настройки</div>

        <v-card
          v-for="section in schema"
          :key="section.section"
          variant="outlined"
          class="mb-4"
        >
          <v-card-title class="text-subtitle-1 font-weight-bold">
            {{ section.section }}
          </v-card-title>

          <v-card-text>
            <div
              v-for="item in section.items"
              :key="item.key"
              class="d-flex align-center justify-space-between py-3"
              :class="{ 'border-b': section.items.indexOf(item) < section.items.length - 1 }"
            >
              <div style="flex: 1; min-width: 0">
                <div class="font-weight-medium">{{ item.label }}</div>
                <div v-if="item.desc" class="text-body-2 text-medium-emphasis">{{ item.desc }}</div>
              </div>

              <div class="ml-4" style="flex-shrink: 0">
                <v-switch
                  v-if="item.type === 'toggle'"
                  :model-value="settings[item.key]"
                  color="primary"
                  hide-details
                  inset
                  density="compact"
                  @update:model-value="saveSetting(item.key, $event)"
                />

                <v-text-field
                  v-else
                  :model-value="settings[item.key] ?? ''"
                  :type="item.type === 'password' ? 'password' : item.type === 'number' ? 'number' : 'text'"
                  :readonly="item.readonly"
                  variant="outlined"
                  density="compact"
                  hide-details
                  style="max-width: 220px"
                  @update:model-value="debounceSave(item, $event)"
                />
              </div>
            </div>
          </v-card-text>
        </v-card>
        <!-- SMTP Actions -->
        <v-card variant="outlined" class="mb-4">
          <v-card-title class="text-subtitle-1 font-weight-bold">
            Действия SMTP
          </v-card-title>
          <v-card-text>
            <div class="d-flex gap-3">
              <v-btn color="primary" variant="outlined" :loading="smtpReloadLoading"
                prepend-icon="mdi-refresh" @click="reloadSmtp">
                Применить настройки
              </v-btn>
              <v-btn color="success" variant="outlined" :loading="smtpTestLoading"
                prepend-icon="mdi-connection" @click="testSmtp">
                Проверить соединение
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </template>
    </v-container>
  </AdminLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '@/services/api.js';
import { toast } from '@/composables/useToast.js';
import AdminLayout from '@/components/layout/AdminLayout.vue';

const schema = [
  { section: 'Регистрация', items: [
    { key: 'registration.enabled', label: 'Регистрация пользователей', desc: 'Разрешить самостоятельную регистрацию', type: 'toggle' }
  ]},
  { section: 'Хранилище', items: [
    { key: 'storage.maxFileSize', label: 'Макс. размер файла (байт)', desc: 'По умолчанию 50 МБ', type: 'number' },
    { key: 'storage.path', label: 'Путь к хранилищу', desc: 'Папка для зашифрованных вложений', type: 'text', readonly: true }
  ]},
  { section: 'Тикеты', items: [
    { key: 'tickets.autoCloseAfterDays', label: 'Автозакрытие (дней)', desc: 'Автозакрытие resolved тикетов', type: 'number' }
  ]},
  { section: 'ML-группировка', items: [
    { key: 'grouping.similarityThreshold', label: 'Порог сходства', desc: 'От 0 до 1, по умолчанию 0.75', type: 'number' }
  ]},
  { section: 'Email (SMTP)', items: [
    { key: 'smtp.host', label: 'SMTP хост', desc: 'Например: smtp.gmail.com', type: 'text' },
    { key: 'smtp.port', label: 'SMTP порт', desc: '465 для SSL, 587 для TLS', type: 'number' },
    { key: 'smtp.secure', label: 'SSL/TLS', desc: 'Включить для порта 465', type: 'toggle' },
    { key: 'smtp.user', label: 'Логин SMTP', type: 'text' },
    { key: 'smtp.pass', label: 'Пароль SMTP', type: 'password' },
    { key: 'smtp.from', label: 'Адрес отправителя', desc: 'noreply@example.com', type: 'text' }
  ]},
  { section: 'Приложение', items: [
    { key: 'app.name', label: 'Название системы', type: 'text' }
  ]}
];

const smtpTestLoading = ref(false);
const smtpReloadLoading = ref(false);

const settings = ref({});
const loading = ref(true);

const saveTimers = {};

function debounceSave(item, value) {
  clearTimeout(saveTimers[item.key]);
  saveTimers[item.key] = setTimeout(() => {
    const val = item.type === 'number' ? parseFloat(value) : value;
    saveSetting(item.key, val);
  }, 800);
}

async function saveSetting(key, value) {
  try {
    await api.put(`/admin/settings/${key}`, { value });
    settings.value[key] = value;
    toast.success('Сохранено');
  } catch (err) {
    toast.error(err.message);
  }
}

async function testSmtp() {
  smtpTestLoading.value = true;
  try {
    const res = await api.post('/admin/smtp/test');
    if (res.data.success) toast.success(res.data.message);
    else toast.error(res.data.message);
  } catch (err) { toast.error(err.message); }
  smtpTestLoading.value = false;
}

async function reloadSmtp() {
  smtpReloadLoading.value = true;
  try {
    await api.post('/admin/smtp/reload');
    toast.success('SMTP конфигурация обновлена');
  } catch (err) { toast.error(err.message); }
  smtpReloadLoading.value = false;
}

onMounted(async () => {
  try {
    const res = await api.get('/admin/settings');
    settings.value = res.data;
  } catch (err) { toast.error(err.message); }
  loading.value = false;
});
</script>

<style scoped>
.border-b {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
