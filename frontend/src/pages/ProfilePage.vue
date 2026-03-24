<template>
  <MainLayout>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" @click="router.push('/')" class="mr-2" />
      <h1 class="text-h5 font-weight-bold">Личный кабинет</h1>
    </div>

    <v-tabs v-model="tab" color="primary" class="mb-4">
      <v-tab value="profile" prepend-icon="mdi-account">Профиль</v-tab>
      <v-tab value="notifications" prepend-icon="mdi-bell-cog">Уведомления</v-tab>
    </v-tabs>

    <v-tabs-window v-model="tab">
      <!-- Profile Tab -->
      <v-tabs-window-item value="profile">
        <v-row>
          <v-col cols="12" md="6">
            <v-card>
              <v-card-title>Профиль</v-card-title>
              <v-card-text>
                <v-text-field v-model="profile.displayName" label="Имя" variant="outlined"
                  density="compact" class="mb-3" />
                <v-text-field v-model="profile.email" label="Email (контактный)" variant="outlined"
                  density="compact" class="mb-3" />
                <v-text-field :model-value="profile.login" label="Логин" variant="outlined"
                  density="compact" readonly class="mb-3" />
                <v-chip :color="roleColor" class="mb-3">{{ roleLabel }}</v-chip>
              </v-card-text>
              <v-card-actions>
                <v-spacer />
                <v-btn color="primary" :loading="savingProfile" @click="saveProfile">Сохранить</v-btn>
              </v-card-actions>
            </v-card>

            <!-- Change password -->
            <v-card class="mt-4">
              <v-card-title>Смена пароля</v-card-title>
              <v-card-text>
                <v-text-field v-model="passwords.current" label="Текущий пароль" variant="outlined"
                  density="compact" type="password" class="mb-3" />
                <v-text-field v-model="passwords.new" label="Новый пароль" variant="outlined"
                  density="compact" type="password" hint="Минимум 8 символов" class="mb-3" />
                <v-text-field v-model="passwords.confirm" label="Подтверждение" variant="outlined"
                  density="compact" type="password" />
              </v-card-text>
              <v-card-actions>
                <v-spacer />
                <v-btn color="primary" :loading="savingPassword" @click="changePassword"
                  :disabled="!passwords.current || !passwords.new">Сменить пароль</v-btn>
              </v-card-actions>
            </v-card>
          </v-col>

          <v-col cols="12" md="6">
            <!-- Email verification -->
            <v-card>
              <v-card-title>
                <v-icon class="mr-2">mdi-email-check</v-icon>
                Email для уведомлений
              </v-card-title>
              <v-card-text>
                <v-alert v-if="profile.verifiedEmail" type="success" variant="tonal" class="mb-3">
                  <div class="d-flex align-center justify-space-between">
                    <div>
                      <div class="font-weight-medium">{{ profile.verifiedEmail }}</div>
                      <div class="text-body-2">Email подтверждён</div>
                    </div>
                    <v-btn variant="text" size="small" color="error" @click="unlinkEmail">Отвязать</v-btn>
                  </div>
                </v-alert>

                <template v-if="!profile.verifiedEmail">
                  <v-alert v-if="!smtpAvailable" type="warning" variant="tonal" class="mb-3">
                    SMTP сервер не настроен. Обратитесь к администратору для настройки email-уведомлений.
                  </v-alert>

                  <template v-else>
                    <div v-if="!codeSent">
                      <v-text-field v-model="verifyEmail" label="Email для привязки" variant="outlined"
                        density="compact" type="email" placeholder="your@email.com" class="mb-3" />
                      <v-btn color="primary" block :loading="sendingCode" @click="sendCode"
                        :disabled="!verifyEmail">Отправить код</v-btn>
                    </div>

                    <div v-else>
                      <v-alert type="info" variant="tonal" class="mb-3">
                        Код отправлен на <strong>{{ verifyEmail }}</strong>
                      </v-alert>
                      <v-text-field v-model="verifyCode" label="Код подтверждения" variant="outlined"
                        density="compact" maxlength="6" placeholder="000000" class="mb-3"
                        style="font-size: 1.5rem; letter-spacing: 4px; text-align: center" />
                      <div class="d-flex gap-2">
                        <v-btn variant="outlined" @click="codeSent = false">Назад</v-btn>
                        <v-btn color="primary" :loading="verifying" @click="verifyEmailCode"
                          :disabled="verifyCode.length < 6">Подтвердить</v-btn>
                      </div>
                    </div>
                  </template>
                </template>
              </v-card-text>
            </v-card>

            <!-- Push notifications -->
            <v-card class="mt-4">
              <v-card-title>
                <v-icon class="mr-2">mdi-cellphone-message</v-icon>
                Push-уведомления
              </v-card-title>
              <v-card-text>
                <v-alert v-if="!pushSupported" type="warning" variant="tonal" class="mb-3" density="compact">
                  Ваш браузер не поддерживает Push-уведомления или сайт открыт по HTTP.
                  Для Push требуется HTTPS.
                </v-alert>

                <template v-else>
                  <v-alert type="info" variant="tonal" class="mb-3" density="compact">
                    Push привязаны к конкретному браузеру. Включите на каждом устройстве.
                  </v-alert>

                  <div class="d-flex align-center justify-space-between">
                    <div>
                      <div class="font-weight-medium">
                        {{ pushSubscribed ? 'Включены' : 'Выключены' }}
                      </div>
                      <div class="text-body-2 text-medium-emphasis">
                        Подписок: {{ pushCount }}
                      </div>
                    </div>
                    <v-switch v-model="pushSubscribed" color="primary" hide-details
                      :loading="togglingPush" @update:model-value="togglePush" />
                  </div>
                </template>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-tabs-window-item>

      <!-- Notifications Tab -->
      <v-tabs-window-item value="notifications">
        <v-card>
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-tune</v-icon>
            Настройка уведомлений
          </v-card-title>
          <v-card-subtitle>
            Выберите, на какие события и каким способом получать уведомления
          </v-card-subtitle>

          <v-card-text>
            <v-alert type="info" variant="tonal" class="mb-4" density="compact">
              <v-icon class="mr-1">mdi-information</v-icon>
              Если вы находитесь на сайте, уведомления приходят только в приложение.
              Push и Email отправляются только когда вы оффлайн — чтобы не дублировать.
            </v-alert>

            <v-progress-circular v-if="loadingPrefs" indeterminate class="d-block mx-auto my-6" />

            <v-table v-else density="comfortable">
              <thead>
                <tr>
                  <th>Событие</th>
                  <th class="text-center" style="width: 100px">
                    <v-icon size="small" class="mr-1">mdi-bell</v-icon>
                    В приложении
                  </th>
                  <th class="text-center" style="width: 100px">
                    <v-icon size="small" class="mr-1">mdi-cellphone</v-icon>
                    Push
                  </th>
                  <th class="text-center" style="width: 100px">
                    <v-icon size="small" class="mr-1">mdi-email</v-icon>
                    Email
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="pref in notifPrefs" :key="pref.trigger">
                  <td>{{ pref.label }}</td>
                  <td class="text-center">
                    <v-checkbox-btn v-model="pref.channelApp" color="primary"
                      @update:model-value="savePrefs" />
                  </td>
                  <td class="text-center">
                    <v-checkbox-btn v-model="pref.channelPush" color="primary"
                      @update:model-value="savePrefs" :disabled="!pushSubscribed" />
                  </td>
                  <td class="text-center">
                    <v-checkbox-btn v-model="pref.channelEmail" color="primary"
                      @update:model-value="savePrefs" :disabled="!profile.verifiedEmail" />
                  </td>
                </tr>
              </tbody>
            </v-table>

            <div v-if="!pushSubscribed" class="text-body-2 text-medium-emphasis mt-2">
              <v-icon size="small">mdi-information</v-icon>
              Push-уведомления не включены. Включите их во вкладке «Профиль».
            </div>
            <div v-if="!profile.verifiedEmail" class="text-body-2 text-medium-emphasis mt-1">
              <v-icon size="small">mdi-information</v-icon>
              Email не привязан. Привяжите email во вкладке «Профиль».
            </div>
          </v-card-text>
        </v-card>
      </v-tabs-window-item>
    </v-tabs-window>
  </MainLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { api } from '@/services/api.js';
import { toast } from '@/composables/useToast.js';
import { pushService } from '@/services/push.js';
import MainLayout from '@/components/layout/MainLayout.vue';

const router = useRouter();
const authStore = useAuthStore();

const tab = ref('profile');

// Profile
const profile = reactive({
  login: '', displayName: '', email: '', role: '', verifiedEmail: null
});
const savingProfile = ref(false);

// Password
const passwords = reactive({ current: '', new: '', confirm: '' });
const savingPassword = ref(false);

// Email verification
const smtpAvailable = ref(false);
const verifyEmail = ref('');
const codeSent = ref(false);
const sendingCode = ref(false);
const verifyCode = ref('');
const verifying = ref(false);

// Push
const pushSupported = ref(false);
const pushSubscribed = ref(false);
const pushCount = ref(0);
const togglingPush = ref(false);

// Notification preferences
const notifPrefs = ref([]);
const loadingPrefs = ref(true);

const roleLabels = { USER: 'Пользователь', AGENT: 'Агент', ADMIN: 'Администратор' };
const roleColors = { USER: 'blue', AGENT: 'orange', ADMIN: 'red' };
const roleLabel = computed(() => roleLabels[profile.role] || profile.role);
const roleColor = computed(() => roleColors[profile.role] || 'grey');

async function loadProfile() {
  try {
    const res = await api.get('/profile');
    Object.assign(profile, res.data);
  } catch (err) { toast.error(err.message); }
}

async function saveProfile() {
  savingProfile.value = true;
  try {
    const res = await api.put('/profile', {
      displayName: profile.displayName,
      email: profile.email
    });
    Object.assign(profile, res.data);
    toast.success('Профиль сохранён');
  } catch (err) { toast.error(err.message); }
  savingProfile.value = false;
}

async function changePassword() {
  if (passwords.new !== passwords.confirm) {
    toast.error('Пароли не совпадают');
    return;
  }
  savingPassword.value = true;
  try {
    await api.put('/profile/password', {
      currentPassword: passwords.current,
      newPassword: passwords.new
    });
    toast.success('Пароль изменён');
    passwords.current = '';
    passwords.new = '';
    passwords.confirm = '';
  } catch (err) { toast.error(err.message); }
  savingPassword.value = false;
}

// SMTP status
async function loadSmtpStatus() {
  try {
    const res = await api.get('/profile/smtp-status');
    smtpAvailable.value = res.data.configured;
  } catch { smtpAvailable.value = false; }
}

// Email verification
async function sendCode() {
  sendingCode.value = true;
  try {
    await api.post('/profile/email/send-code', { email: verifyEmail.value });
    codeSent.value = true;
    toast.success('Код отправлен');
  } catch (err) { toast.error(err.message); }
  sendingCode.value = false;
}

async function verifyEmailCode() {
  verifying.value = true;
  try {
    const res = await api.post('/profile/email/verify', { code: verifyCode.value });
    profile.verifiedEmail = res.data.verifiedEmail;
    codeSent.value = false;
    verifyCode.value = '';
    toast.success('Email подтверждён!');
  } catch (err) { toast.error(err.message); }
  verifying.value = false;
}

async function unlinkEmail() {
  try {
    await api.delete('/profile/email/verified');
    profile.verifiedEmail = null;
    toast.success('Email отвязан');
  } catch (err) { toast.error(err.message); }
}

// Push
async function loadPushStatus() {
  pushSupported.value = pushService.supported;
  if (!pushSupported.value) return;
  try {
    await pushService.init();
    const res = await api.get('/profile/push-status');
    pushCount.value = res.data.count;
    pushSubscribed.value = await pushService.isSubscribed();
  } catch { /* ignore */ }
}

async function togglePush(val) {
  togglingPush.value = true;
  try {
    if (val) {
      await pushService.subscribe();
      toast.success('Push-уведомления включены');
    } else {
      await pushService.unsubscribe();
      toast.info('Push-уведомления отключены');
    }
    await loadPushStatus();
  } catch (err) {
    toast.error(err.message || 'Не удалось изменить настройку push');
    pushSubscribed.value = !val; // revert
  }
  togglingPush.value = false;
}

// Notification preferences
async function loadPrefs() {
  loadingPrefs.value = true;
  try {
    const res = await api.get('/profile/notification-preferences');
    notifPrefs.value = res.data;
  } catch (err) { toast.error(err.message); }
  loadingPrefs.value = false;
}

let savePrefsTimer = null;
function savePrefs() {
  clearTimeout(savePrefsTimer);
  savePrefsTimer = setTimeout(async () => {
    try {
      await api.put('/profile/notification-preferences', {
        preferences: notifPrefs.value.map(p => ({
          trigger: p.trigger,
          channelApp: p.channelApp,
          channelPush: p.channelPush,
          channelEmail: p.channelEmail,
        }))
      });
      toast.success('Настройки сохранены');
    } catch (err) { toast.error(err.message); }
  }, 500);
}

onMounted(async () => {
  await Promise.all([
    loadProfile(),
    loadSmtpStatus(),
    loadPushStatus(),
    loadPrefs()
  ]);
});
</script>
