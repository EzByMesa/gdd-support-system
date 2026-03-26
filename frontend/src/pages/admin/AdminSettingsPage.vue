<template>
  <AdminLayout>
    <v-container fluid>
      <div class="text-h5 font-weight-bold mb-6">Настройки</div>

      <v-row v-if="loading" justify="center" class="my-10">
        <v-progress-circular indeterminate color="primary" size="48" />
      </v-row>

      <template v-else>
        <v-tabs v-model="tab" color="primary" class="mb-4">
          <v-tab value="general" prepend-icon="mdi-cog">Общие</v-tab>
          <v-tab value="tickets" prepend-icon="mdi-ticket">Тикеты</v-tab>
          <v-tab value="email" prepend-icon="mdi-email">Email</v-tab>
          <v-tab value="features" prepend-icon="mdi-puzzle">Модули</v-tab>
        </v-tabs>

        <v-tabs-window v-model="tab">
          <!-- ===== ОБЩИЕ ===== -->
          <v-tabs-window-item value="general">
            <v-card variant="outlined" class="mb-4">
              <v-card-title class="text-subtitle-1 font-weight-bold">Приложение</v-card-title>
              <v-card-text>
                <SettingRow label="Название системы" :value="settings['app.name']"
                  type="text" @save="v => saveSetting('app.name', v)" />
              </v-card-text>
            </v-card>

            <v-card variant="outlined" class="mb-4">
              <v-card-title class="text-subtitle-1 font-weight-bold">Регистрация</v-card-title>
              <v-card-text>
                <SettingRow label="Самостоятельная регистрация" desc="Разрешить пользователям регистрироваться"
                  :value="settings['registration.enabled']" type="toggle"
                  @save="v => saveSetting('registration.enabled', v)" />
              </v-card-text>
            </v-card>

            <v-card variant="outlined" class="mb-4">
              <v-card-title class="text-subtitle-1 font-weight-bold">Хранилище</v-card-title>
              <v-card-text>
                <SettingRow label="Макс. размер файла (байт)" desc="По умолчанию 50 МБ"
                  :value="settings['storage.maxFileSize']" type="number"
                  @save="v => saveSetting('storage.maxFileSize', parseFloat(v))" />
                <SettingRow label="Путь к хранилищу" :value="settings['storage.path']"
                  type="text" readonly />
              </v-card-text>
            </v-card>
          </v-tabs-window-item>

          <!-- ===== ТИКЕТЫ ===== -->
          <v-tabs-window-item value="tickets">
            <v-card variant="outlined" class="mb-4">
              <v-card-title class="text-subtitle-1 font-weight-bold">Автоматизация</v-card-title>
              <v-card-text>
                <SettingRow label="Автозакрытие (дней)" desc="Автозакрытие resolved тикетов через N дней"
                  :value="settings['tickets.autoCloseAfterDays']" type="number"
                  @save="v => saveSetting('tickets.autoCloseAfterDays', parseFloat(v))" />
              </v-card-text>
            </v-card>

            <v-card variant="outlined" class="mb-4">
              <v-card-title class="text-subtitle-1 font-weight-bold">ML-группировка</v-card-title>
              <v-card-text>
                <SettingRow label="Порог сходства" desc="От 0 до 1, по умолчанию 0.75"
                  :value="settings['grouping.similarityThreshold']" type="number"
                  @save="v => saveSetting('grouping.similarityThreshold', parseFloat(v))" />
              </v-card-text>
            </v-card>
          </v-tabs-window-item>

          <!-- ===== EMAIL ===== -->
          <v-tabs-window-item value="email">
            <v-card variant="outlined" class="mb-4">
              <v-card-title class="text-subtitle-1 font-weight-bold">SMTP</v-card-title>
              <v-card-text>
                <SettingRow label="Хост" desc="smtp.gmail.com" :value="settings['smtp.host']"
                  type="text" @save="v => saveSetting('smtp.host', v)" />
                <SettingRow label="Порт" desc="465 для SSL, 587 для TLS" :value="settings['smtp.port']"
                  type="number" @save="v => saveSetting('smtp.port', parseFloat(v))" />
                <SettingRow label="SSL/TLS" :value="settings['smtp.secure']"
                  type="toggle" @save="v => saveSetting('smtp.secure', v)" />
                <SettingRow label="Логин" :value="settings['smtp.user']"
                  type="text" @save="v => saveSetting('smtp.user', v)" />
                <SettingRow label="Пароль" :value="settings['smtp.pass']"
                  type="password" @save="v => saveSetting('smtp.pass', v)" />
                <SettingRow label="Отправитель" desc="noreply@example.com" :value="settings['smtp.from']"
                  type="text" @save="v => saveSetting('smtp.from', v)" />
              </v-card-text>
            </v-card>

            <v-card variant="outlined" class="mb-4">
              <v-card-text>
                <div class="d-flex" style="gap: 12px">
                  <v-btn color="primary" variant="outlined" :loading="smtpReloadLoading"
                    prepend-icon="mdi-refresh" @click="reloadSmtp">Применить</v-btn>
                  <v-btn color="success" variant="outlined" :loading="smtpTestLoading"
                    prepend-icon="mdi-connection" @click="testSmtp">Проверить</v-btn>
                </div>
              </v-card-text>
            </v-card>
          </v-tabs-window-item>

          <!-- ===== МОДУЛИ ===== -->
          <v-tabs-window-item value="features">
            <v-card variant="outlined" class="mb-4">
              <v-card-title class="text-subtitle-1 font-weight-bold">Функциональные модули</v-card-title>
              <v-card-text>
                <SettingRow label="База знаний"
                  desc="Публичная страница статей, подсказки при создании тикета, конвертация закрытых тикетов"
                  :value="settings['knowledge.enabled']" type="toggle"
                  @save="v => saveSetting('knowledge.enabled', v)" />
              </v-card-text>
            </v-card>

            <v-alert type="info" variant="tonal">
              После включения/отключения модулей обновите страницу для применения изменений в навигации.
            </v-alert>
          </v-tabs-window-item>
        </v-tabs-window>
      </template>
    </v-container>
  </AdminLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '@/services/api.js';
import { toast } from '@/composables/useToast.js';
import AdminLayout from '@/components/layout/AdminLayout.vue';
import SettingRow from '@/components/ui/SettingRow.vue';

const tab = ref('general');
const settings = ref({});
const loading = ref(true);
const smtpTestLoading = ref(false);
const smtpReloadLoading = ref(false);

async function saveSetting(key, value) {
  try {
    await api.put(`/admin/settings/${key}`, { value });
    settings.value[key] = value;
    toast.success('Сохранено');
  } catch (err) { toast.error(err.message); }
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
    toast.success('SMTP обновлён');
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
