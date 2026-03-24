<template>
  <v-app>
    <v-main class="bg-gradient-auth d-flex align-center" style="min-height: 100vh">
      <v-container>
        <v-row align="center" justify="center">
          <v-col cols="12" sm="8" md="5" lg="4">
            <div class="text-center mb-6">
              <v-icon size="40" color="primary" class="mb-2">mdi-headset</v-icon>
              <h1 class="text-h5 font-weight-bold">GDD Support</h1>
              <p class="text-caption mt-1" style="color: rgba(255,255,255,0.4)">Система поддержки</p>
            </div>
            <v-card class="pa-6" rounded="xl" elevation="12" color="surface-light">

          <v-card-text class="pt-4">
            <!-- Provider toggle -->
            <v-btn-toggle
              v-if="hasOneC"
              v-model="mode"
              mandatory
              color="primary"
              class="mb-6"
              density="comfortable"
              rounded="lg"
              style="width: 100%"
            >
              <v-btn value="local" style="flex: 1">
                <v-icon start>mdi-account-key</v-icon>
                Логин и пароль
              </v-btn>
              <v-btn value="1c" style="flex: 1">
                <v-icon start>mdi-domain</v-icon>
                {{ oneCProviderName }}
              </v-btn>
            </v-btn-toggle>

            <!-- Error alert -->
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

            <!-- Local login form -->
            <v-form v-if="mode === 'local'" ref="localFormRef" @submit.prevent="handleLocalLogin">
              <v-text-field
                v-model="loginField"
                label="Логин"
                prepend-inner-icon="mdi-account"
                variant="outlined"
                density="comfortable"
                :rules="[rules.required]"
                class="mb-1"
                autocomplete="username"
              />
              <v-text-field
                v-model="passwordField"
                label="Пароль"
                prepend-inner-icon="mdi-lock"
                variant="outlined"
                density="comfortable"
                :type="showPassword ? 'text' : 'password'"
                :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                :rules="[rules.required]"
                class="mb-2"
                autocomplete="current-password"
                @click:append-inner="showPassword = !showPassword"
              />
              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="loading"
              >
                <v-icon start>mdi-login</v-icon>
                Войти
              </v-btn>
            </v-form>

            <!-- 1C login form -->
            <v-form v-else ref="oneCFormRef" @submit.prevent="handleOneCLogin">
              <p class="text-center text-medium-emphasis text-body-2 mb-4">
                Вход через {{ oneCProviderName }}
              </p>
              <v-text-field
                v-model="loginField"
                label="Логин 1С"
                prepend-inner-icon="mdi-account"
                variant="outlined"
                density="comfortable"
                :rules="[rules.required]"
                class="mb-1"
                placeholder="Логин в 1С"
              />
              <v-text-field
                v-model="passwordField"
                label="Пароль 1С"
                prepend-inner-icon="mdi-lock"
                variant="outlined"
                density="comfortable"
                :type="showPassword ? 'text' : 'password'"
                :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                :rules="[rules.required]"
                class="mb-2"
                @click:append-inner="showPassword = !showPassword"
              />
              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="loading"
              >
                <v-icon start>mdi-domain</v-icon>
                Войти через {{ oneCProviderName }}
              </v-btn>
            </v-form>
          </v-card-text>

          <v-card-actions class="justify-center pt-2">
            <span class="text-body-2 text-medium-emphasis">
              Нет аккаунта?
              <router-link to="/register" class="text-primary text-decoration-none font-weight-medium">
                Зарегистрироваться
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
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { useNotificationStore } from '@/stores/notifications.js';
import { toast } from '@/composables/useToast.js';

const router = useRouter();
const authStore = useAuthStore();
const notifStore = useNotificationStore();

const mode = ref('local');
const loginField = ref('');
const passwordField = ref('');
const showPassword = ref(false);
const loading = ref(false);
const errorMessage = ref('');
const providers = ref([]);
const localFormRef = ref(null);
const oneCFormRef = ref(null);

const rules = {
  required: v => !!v || 'Обязательное поле'
};

const hasOneC = computed(() => providers.value.some(p => p.type === 'ONE_C'));
const oneCProviderName = computed(() => {
  const p = providers.value.find(p => p.type === 'ONE_C');
  return p?.name || '1С';
});

async function loadProviders() {
  try {
    const res = await fetch('/api/auth/providers');
    if (res.ok) {
      const { data } = await res.json();
      providers.value = data || [];
    }
  } catch {
    providers.value = [{ type: 'LOCAL', name: 'Логин и пароль' }];
  }
}

async function handleLocalLogin() {
  const { valid } = await localFormRef.value.validate();
  if (!valid) return;

  loading.value = true;
  errorMessage.value = '';
  try {
    await authStore.login(loginField.value, passwordField.value);
    await notifStore.init();
    router.push('/');
  } catch (err) {
    errorMessage.value = err.message || 'Ошибка входа';
    toast.error(err.message || 'Ошибка входа');
    loading.value = false;
  }
}

async function handleOneCLogin() {
  const { valid } = await oneCFormRef.value.validate();
  if (!valid) return;

  loading.value = true;
  errorMessage.value = '';
  try {
    await authStore.loginOneC(loginField.value, passwordField.value);
    await notifStore.init();
    router.push('/');
  } catch (err) {
    errorMessage.value = err.message || 'Ошибка входа через 1С';
    toast.error(err.message || 'Ошибка входа через 1С');
    loading.value = false;
  }
}

onMounted(loadProviders);
</script>
