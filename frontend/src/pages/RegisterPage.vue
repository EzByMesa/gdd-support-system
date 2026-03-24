<template>
  <v-app>
    <v-main class="bg-gradient-auth d-flex align-center" style="min-height: 100vh">
      <v-container>
        <v-row align="center" justify="center">
          <v-col cols="12" sm="8" md="6" lg="5">
            <v-card class="pa-6" elevation="12" rounded="xl">
              <v-card-title class="text-center pb-1">
            <div>
              <div class="text-h4 font-weight-bold">GDD Support</div>
              <div class="text-subtitle-1 text-medium-emphasis mt-1">Регистрация</div>
            </div>
          </v-card-title>

          <v-card-text class="pt-4">
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

            <v-form ref="formRef" @submit.prevent="handleRegister">
              <v-text-field
                v-model="form.displayName"
                label="Имя"
                prepend-inner-icon="mdi-badge-account-horizontal"
                variant="outlined"
                density="comfortable"
                placeholder="Как к вам обращаться"
                :rules="[rules.required, rules.displayName]"
                :error-messages="errors.displayName ? [errors.displayName] : []"
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
                :error-messages="errors.login ? [errors.login] : []"
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
                :error-messages="errors.email ? [errors.email] : []"
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
                :error-messages="errors.password ? [errors.password] : []"
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
                :error-messages="errors.passwordConfirm ? [errors.passwordConfirm] : []"
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
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { useNotificationStore } from '@/stores/notifications.js';
import { toast } from '@/composables/useToast.js';
import { validateLogin, validatePassword, validateEmail } from '@/utils/validate.js';

const router = useRouter();
const authStore = useAuthStore();
const notifStore = useNotificationStore();

const loading = ref(false);
const errorMessage = ref('');
const showPassword = ref(false);
const showPasswordConfirm = ref(false);
const formRef = ref(null);

const form = reactive({
  displayName: '',
  login: '',
  email: '',
  password: '',
  passwordConfirm: ''
});

const errors = reactive({
  displayName: '',
  login: '',
  email: '',
  password: '',
  passwordConfirm: ''
});

const rules = {
  required: v => !!v || 'Обязательное поле',
  login: v => {
    if (!v) return true; // handled by required
    const err = validateLogin(v);
    return err || true;
  },
  password: v => {
    if (!v) return true;
    const err = validatePassword(v);
    return err || true;
  },
  email: v => {
    if (!v) return true; // email is optional
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

function clearErrors() {
  Object.keys(errors).forEach(k => errors[k] = '');
}

async function handleRegister() {
  clearErrors();
  errorMessage.value = '';

  const { valid } = await formRef.value.validate();

  // Additional manual validation
  let hasErrors = false;

  const loginErr = validateLogin(form.login);
  if (loginErr) { errors.login = loginErr; hasErrors = true; }

  const passErr = validatePassword(form.password);
  if (passErr) { errors.password = passErr; hasErrors = true; }

  const emailErr = validateEmail(form.email);
  if (emailErr) { errors.email = emailErr; hasErrors = true; }

  if (!form.displayName.trim()) { errors.displayName = 'Укажите имя'; hasErrors = true; }

  if (form.password !== form.passwordConfirm) {
    errors.passwordConfirm = 'Пароли не совпадают';
    hasErrors = true;
  }

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
</script>
