<template>
  <v-app>
    <v-main class="bg-gradient-auth d-flex align-center" style="min-height: 100vh">
      <v-container>
        <v-row align="center" justify="center">
          <v-col cols="12" sm="8" md="6" lg="5">
            <div class="text-center mb-6">
              <v-icon size="40" color="primary" class="mb-2">mdi-headset</v-icon>
              <h1 class="text-h5 font-weight-bold">GDD Служба поддержки</h1>
              <p class="text-caption mt-1" style="color: rgba(255,255,255,0.4)">Регистрация</p>
            </div>

            <v-card class="pa-6" elevation="12" rounded="xl">
              <v-card-text class="pt-2">
                <!-- Tab toggle: показываем если есть оба варианта -->
                <v-btn-toggle
                  v-if="hasProvider && registrationEnabled"
                  v-model="mode"
                  mandatory
                  color="primary"
                  class="mb-6"
                  density="comfortable"
                  rounded="lg"
                  style="width: 100%"
                >
                  <v-btn value="provider" style="flex: 1">
                    <v-icon start>mdi-cog</v-icon>
                    {{ providerName }}
                  </v-btn>
                  <v-btn value="local" style="flex: 1">
                    <v-icon start>mdi-account-plus</v-icon>
                    Обычная
                  </v-btn>
                </v-btn-toggle>

                <v-alert
                  v-if="errorMessage"
                  type="error"
                  variant="tonal"
                  closable
                  class="mb-4"
                  @click:close="errorMessage = ''"
                >
                  {{ errorMessage }}
                </v-alert>

                <!-- ===== PROVIDER REGISTRATION ===== -->
                <template v-if="mode === 'provider' && hasProvider">
                  <!-- Step 1: credentials -->
                  <v-form v-if="!providerProfile" ref="providerFormRef" @submit.prevent="handleFetchProfile">
                    <p class="text-center text-medium-emphasis text-body-2 mb-4">
                      Введите данные от {{ providerName }}
                    </p>
                    <v-text-field
                      v-model="providerCreds.login"
                      label="Логин"
                      prepend-inner-icon="mdi-account"
                      variant="outlined"
                      density="comfortable"
                      :rules="[rules.required]"
                      class="mb-1"
                    />
                    <v-text-field
                      v-model="providerCreds.password"
                      label="Пароль"
                      prepend-inner-icon="mdi-lock"
                      variant="outlined"
                      density="comfortable"
                      :type="showProviderPassword ? 'text' : 'password'"
                      :append-inner-icon="showProviderPassword ? 'mdi-eye-off' : 'mdi-eye'"
                      :rules="[rules.required]"
                      class="mb-2"
                      @click:append-inner="showProviderPassword = !showProviderPassword"
                    />
                    <v-btn
                      type="submit"
                      color="primary"
                      size="large"
                      block
                      :loading="providerLoading"
                    >
                      <v-icon start>mdi-account-search</v-icon>
                      Найти профиль
                    </v-btn>
                  </v-form>

                  <!-- Step 2: preview & confirm -->
                  <div v-else>
                    <v-alert type="success" variant="tonal" class="mb-4">
                      Профиль найден в {{ providerName }}
                    </v-alert>

                    <v-list density="compact" class="mb-4" bg-color="transparent">
                      <v-list-item prepend-icon="mdi-account">
                        <v-list-item-title>{{ providerProfile.name }}</v-list-item-title>
                        <v-list-item-subtitle>Имя</v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item v-if="providerProfile.email" prepend-icon="mdi-email">
                        <v-list-item-title>{{ providerProfile.email }}</v-list-item-title>
                        <v-list-item-subtitle>Email</v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item v-if="providerProfile.phone" prepend-icon="mdi-phone">
                        <v-list-item-title>{{ providerProfile.phone }}</v-list-item-title>
                        <v-list-item-subtitle>Телефон</v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item v-if="providerProfile.district" prepend-icon="mdi-map-marker">
                        <v-list-item-title>{{ providerProfile.district }}</v-list-item-title>
                        <v-list-item-subtitle>Район</v-list-item-subtitle>
                      </v-list-item>
                    </v-list>

                    <p class="text-body-2 text-medium-emphasis mb-4">
                      Для входа в систему будут использоваться ваши логин и пароль от {{ providerName }}.
                    </p>

                    <v-btn
                      color="primary"
                      size="large"
                      block
                      :loading="providerLoading"
                      @click="handleProviderRegister"
                    >
                      <v-icon start>mdi-account-plus</v-icon>
                      Зарегистрироваться
                    </v-btn>
                    <v-btn
                      variant="text"
                      size="small"
                      block
                      class="mt-2"
                      @click="providerProfile = null"
                    >
                      Назад
                    </v-btn>
                  </div>
                </template>

                <!-- ===== LOCAL REGISTRATION ===== -->
                <v-form v-if="mode === 'local' && registrationEnabled" ref="localFormRef" @submit.prevent="handleRegister">
                  <v-text-field
                    v-model="form.displayName"
                    label="Имя"
                    prepend-inner-icon="mdi-badge-account-horizontal"
                    variant="outlined"
                    density="comfortable"
                    placeholder="Как к вам обращаться"
                    :rules="[rules.required, rules.displayName]"
                    class="mb-1"
                  />
                  <v-text-field
                    v-model="form.login"
                    label="Логин"
                    prepend-inner-icon="mdi-account"
                    variant="outlined"
                    density="comfortable"
                    placeholder="Латиница, цифры, _ . -"
                    :rules="[rules.required, rules.login]"
                    class="mb-1"
                    autocomplete="username"
                  />
                  <v-text-field
                    v-model="form.email"
                    label="Email (необязательно)"
                    prepend-inner-icon="mdi-email"
                    variant="outlined"
                    density="comfortable"
                    placeholder="name@company.com"
                    :rules="[rules.email]"
                    class="mb-1"
                    type="email"
                  />
                  <v-text-field
                    v-model="form.password"
                    label="Пароль"
                    prepend-inner-icon="mdi-lock"
                    variant="outlined"
                    density="comfortable"
                    placeholder="Минимум 8 символов"
                    :type="showPassword ? 'text' : 'password'"
                    :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                    :rules="[rules.required, rules.password]"
                    class="mb-1"
                    autocomplete="new-password"
                    @click:append-inner="showPassword = !showPassword"
                  />
                  <v-text-field
                    v-model="form.passwordConfirm"
                    label="Подтверждение пароля"
                    prepend-inner-icon="mdi-lock-check"
                    variant="outlined"
                    density="comfortable"
                    :type="showPasswordConfirm ? 'text' : 'password'"
                    :append-inner-icon="showPasswordConfirm ? 'mdi-eye-off' : 'mdi-eye'"
                    :rules="[rules.required, rules.passwordMatch]"
                    class="mb-2"
                    autocomplete="new-password"
                    @click:append-inner="showPasswordConfirm = !showPasswordConfirm"
                  />

                  <v-btn
                    type="submit"
                    color="primary"
                    size="large"
                    block
                    :loading="loading"
                  >
                    <v-icon start>mdi-account-plus</v-icon>
                    Зарегистрироваться
                  </v-btn>
                </v-form>
              </v-card-text>

              <v-card-actions class="justify-center pt-2">
                <span class="text-body-2 text-medium-emphasis">
                  Уже есть аккаунт?
                  <router-link to="/login" class="text-primary text-decoration-none font-weight-medium">
                    Войти
                  </router-link>
                </span>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { reactive, ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { useNotificationStore } from '@/stores/notifications.js';
import { toast } from '@/composables/useToast.js';
import { validateLogin, validatePassword, validateEmail } from '@/utils/validate.js';
import config from '@/config.js';

const router = useRouter();
const authStore = useAuthStore();
const notifStore = useNotificationStore();

const mode = ref('provider');
const loading = ref(false);
const providerLoading = ref(false);
const errorMessage = ref('');
const showPassword = ref(false);
const showPasswordConfirm = ref(false);
const showProviderPassword = ref(false);
const localFormRef = ref(null);
const providerFormRef = ref(null);
const providers = ref([]);
const registrationEnabled = ref(true);
const providerProfile = ref(null);

// Local registration form
const form = reactive({
  displayName: '',
  login: '',
  email: '',
  password: '',
  passwordConfirm: ''
});

// Provider credentials
const providerCreds = reactive({ login: '', password: '' });

const hasProvider = computed(() => providers.value.some(p => p.type === 'ONE_C'));
const providerName = computed(() => {
  const p = providers.value.find(p => p.type === 'ONE_C');
  return p?.name || 'СервисДеск';
});

// Установить первый доступный режим
watch([hasProvider, registrationEnabled], () => {
  if (hasProvider.value) {
    mode.value = 'provider';
  } else if (registrationEnabled.value) {
    mode.value = 'local';
  }
}, { immediate: true });

const rules = {
  required: v => !!v || 'Обязательное поле',
  login: v => {
    if (!v) return true;
    const err = validateLogin(v);
    return err || true;
  },
  password: v => {
    if (!v) return true;
    const err = validatePassword(v);
    return err || true;
  },
  email: v => {
    if (!v) return true;
    const err = validateEmail(v);
    return err || true;
  },
  passwordMatch: () => {
    if (form.password !== form.passwordConfirm) return 'Пароли не совпадают';
    return true;
  },
  displayName: v => {
    if (!v || !v.trim()) return 'Укажите имя';
    return true;
  }
};

async function loadProviders() {
  try {
    const res = await fetch(`${config.apiUrl}/auth/providers`);
    if (res.ok) {
      const json = await res.json();
      providers.value = json.data || [];
      registrationEnabled.value = json.registrationEnabled !== false;
    }
  } catch {
    providers.value = [{ type: 'LOCAL', name: 'Логин и пароль' }];
  }
}

// Local registration
async function handleRegister() {
  errorMessage.value = '';
  const { valid } = await localFormRef.value.validate();

  let hasErrors = false;
  if (validateLogin(form.login)) hasErrors = true;
  if (validatePassword(form.password)) hasErrors = true;
  if (form.password !== form.passwordConfirm) hasErrors = true;
  if (!form.displayName.trim()) hasErrors = true;

  if (!valid || hasErrors) return;

  loading.value = true;
  try {
    await authStore.register({
      login: form.login,
      email: form.email,
      password: form.password,
      displayName: form.displayName
    });
    toast.success('Регистрация успешна!');
    await notifStore.init();
    router.push('/');
  } catch (err) {
    errorMessage.value = err.message || 'Ошибка регистрации';
    toast.error(err.message || 'Ошибка регистрации');
    loading.value = false;
  }
}

// Provider Step 1: fetch profile
async function handleFetchProfile() {
  const { valid } = await providerFormRef.value.validate();
  if (!valid) return;

  providerLoading.value = true;
  errorMessage.value = '';
  try {
    const profile = await authStore.fetchOneCProfile(providerCreds.login, providerCreds.password);
    providerProfile.value = profile;
  } catch (err) {
    errorMessage.value = err.message || 'Не удалось получить профиль';
    toast.error(err.message || 'Ошибка');
  } finally {
    providerLoading.value = false;
  }
}

// Provider Step 2: register
async function handleProviderRegister() {
  providerLoading.value = true;
  errorMessage.value = '';
  try {
    await authStore.registerOneC(providerCreds.login, providerCreds.password);
    toast.success('Регистрация успешна!');
    await notifStore.init();
    router.push('/');
  } catch (err) {
    errorMessage.value = err.message || 'Ошибка регистрации';
    toast.error(err.message || 'Ошибка регистрации');
  } finally {
    providerLoading.value = false;
  }
}

onMounted(loadProviders);
</script>
