<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" md="8" lg="7">
        <v-card elevation="8" rounded="lg">
          <v-card-title class="text-center pt-6 pb-2">
            <div class="text-h4 font-weight-bold">Первоначальная настройка</div>
          </v-card-title>

          <v-card-text>
            <v-stepper
              v-model="currentStep"
              :items="stepItems"
              alt-labels
              flat
              hide-actions
            >
              <template v-slot:item.1>
                <v-card flat class="pa-4">
                  <div class="text-h6 mb-1">Подключение к базе данных</div>
                  <div class="text-body-2 text-medium-emphasis mb-4">
                    Выберите тип базы данных и укажите параметры подключения
                  </div>

                  <v-alert
                    v-if="stepError"
                    type="error"
                    variant="tonal"
                    closable
                    class="mb-4"
                    @click:close="stepError = ''"
                  >
                    {{ stepError }}
                  </v-alert>

                  <v-btn-toggle
                    v-model="dbType"
                    mandatory
                    color="primary"
                    class="mb-4"
                    density="comfortable"
                    rounded="lg"
                    style="width: 100%"
                  >
                    <v-btn value="sqlite" style="flex: 1">
                      <v-icon start>mdi-file-document</v-icon>
                      SQLite (рекомендуется)
                    </v-btn>
                    <v-btn value="postgres" style="flex: 1">
                      <v-icon start>mdi-elephant</v-icon>
                      PostgreSQL
                    </v-btn>
                  </v-btn-toggle>

                  <template v-if="dbType === 'sqlite'">
                    <v-alert type="info" variant="tonal" density="compact" class="mb-4">
                      <div class="text-body-2">
                        Файл будет создан автоматически. SQLite подходит для небольших инсталляций.
                      </div>
                    </v-alert>
                    <v-text-field
                      v-model="dbFields.path"
                      label="Путь к файлу базы данных"
                      prepend-inner-icon="mdi-folder-open"
                      variant="outlined"
                      density="comfortable"
                      placeholder="/path/to/database.sqlite"
                    />
                  </template>

                  <template v-else>
                    <v-row>
                      <v-col cols="12" sm="8">
                        <v-text-field
                          v-model="dbFields.host"
                          label="Хост"
                          prepend-inner-icon="mdi-server"
                          variant="outlined"
                          density="comfortable"
                        />
                      </v-col>
                      <v-col cols="12" sm="4">
                        <v-text-field
                          v-model="dbFields.port"
                          label="Порт"
                          prepend-inner-icon="mdi-ethernet"
                          variant="outlined"
                          density="comfortable"
                          type="number"
                        />
                      </v-col>
                    </v-row>
                    <v-text-field
                      v-model="dbFields.database"
                      label="Имя базы данных"
                      prepend-inner-icon="mdi-database"
                      variant="outlined"
                      density="comfortable"
                    />
                    <v-text-field
                      v-model="dbFields.username"
                      label="Пользователь"
                      prepend-inner-icon="mdi-account"
                      variant="outlined"
                      density="comfortable"
                    />
                    <v-text-field
                      v-model="dbFields.password"
                      label="Пароль"
                      prepend-inner-icon="mdi-lock"
                      variant="outlined"
                      density="comfortable"
                      type="password"
                    />
                  </template>

                  <div class="d-flex justify-end ga-3 mt-4">
                    <v-btn
                      v-if="dbType === 'postgres'"
                      variant="outlined"
                      color="secondary"
                      :loading="testLoading"
                      @click="testDatabase"
                    >
                      <v-icon start>mdi-connection</v-icon>
                      Проверить подключение
                    </v-btn>
                    <v-btn
                      color="primary"
                      :loading="loading"
                      @click="submitDatabase"
                    >
                      Далее
                      <v-icon end>mdi-arrow-right</v-icon>
                    </v-btn>
                  </div>
                </v-card>
              </template>

              <template v-slot:item.2>
                <v-card flat class="pa-4">
                  <div class="text-h6 mb-1">Корневой администратор</div>
                  <div class="text-body-2 text-medium-emphasis mb-4">
                    Создайте учётную запись главного администратора системы
                  </div>

                  <v-alert
                    v-if="stepError"
                    type="error"
                    variant="tonal"
                    closable
                    class="mb-4"
                    @click:close="stepError = ''"
                  >
                    {{ stepError }}
                  </v-alert>

                  <v-text-field
                    v-model="adminFields.login"
                    label="Логин"
                    prepend-inner-icon="mdi-account"
                    variant="outlined"
                    density="comfortable"
                    placeholder="admin"
                    class="mb-1"
                  />
                  <v-text-field
                    v-model="adminFields.email"
                    label="Email"
                    prepend-inner-icon="mdi-email"
                    variant="outlined"
                    density="comfortable"
                    placeholder="admin@company.com"
                    type="email"
                    class="mb-1"
                  />
                  <v-text-field
                    v-model="adminFields.displayName"
                    label="Отображаемое имя"
                    prepend-inner-icon="mdi-badge-account-horizontal"
                    variant="outlined"
                    density="comfortable"
                    placeholder="Администратор"
                    class="mb-1"
                  />
                  <v-text-field
                    v-model="adminFields.password"
                    label="Пароль"
                    prepend-inner-icon="mdi-lock"
                    variant="outlined"
                    density="comfortable"
                    type="password"
                    placeholder="Минимум 8 символов"
                    :error-messages="adminErrors.password ? [adminErrors.password] : []"
                    class="mb-1"
                  />
                  <v-text-field
                    v-model="adminFields.passwordConfirm"
                    label="Подтверждение пароля"
                    prepend-inner-icon="mdi-lock-check"
                    variant="outlined"
                    density="comfortable"
                    type="password"
                    :error-messages="adminErrors.passwordConfirm ? [adminErrors.passwordConfirm] : []"
                    class="mb-2"
                  />

                  <div class="d-flex justify-end mt-4">
                    <v-btn
                      color="primary"
                      :loading="loading"
                      @click="submitAdmin"
                    >
                      Далее
                      <v-icon end>mdi-arrow-right</v-icon>
                    </v-btn>
                  </div>
                </v-card>
              </template>

              <template v-slot:item.3>
                <v-card flat class="pa-4">
                  <div class="text-h6 mb-1">Хранилище вложений</div>
                  <div class="text-body-2 text-medium-emphasis mb-4">
                    Укажите путь к папке на сервере для хранения зашифрованных вложений
                  </div>

                  <v-alert
                    v-if="stepError"
                    type="error"
                    variant="tonal"
                    closable
                    class="mb-4"
                    @click:close="stepError = ''"
                  >
                    {{ stepError }}
                  </v-alert>

                  <v-text-field
                    v-model="storagePath"
                    label="Путь к папке"
                    prepend-inner-icon="mdi-folder-lock"
                    variant="outlined"
                    density="comfortable"
                    placeholder="/var/gdd_support/attachments"
                    :error-messages="storageError ? [storageError] : []"
                  />
                  <v-alert type="info" variant="tonal" density="compact" class="mt-2">
                    <div class="text-body-2">
                      Папка будет создана автоматически, если не существует.
                      Файлы хранятся в зашифрованном виде без расширений.
                    </div>
                  </v-alert>

                  <div class="d-flex justify-end mt-4">
                    <v-btn
                      color="primary"
                      :loading="loading"
                      @click="submitStorage"
                    >
                      Далее
                      <v-icon end>mdi-arrow-right</v-icon>
                    </v-btn>
                  </div>
                </v-card>
              </template>

              <template v-slot:item.4>
                <v-card flat class="pa-4">
                  <div class="text-center py-8">
                    <v-icon size="64" color="success" class="mb-4">mdi-check-circle</v-icon>
                    <div class="text-h5 font-weight-bold mb-2">Всё готово!</div>
                    <div class="text-body-1 text-medium-emphasis">
                      Система настроена. Нажмите кнопку ниже для завершения и входа в систему.
                    </div>
                  </div>

                  <div class="d-flex justify-center mt-4">
                    <v-btn
                      color="primary"
                      size="large"
                      :loading="loading"
                      @click="submitComplete"
                    >
                      <v-icon start>mdi-rocket-launch</v-icon>
                      Завершить настройку
                    </v-btn>
                  </div>
                </v-card>
              </template>
            </v-stepper>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { api } from '@/services/api.js';
import { toast } from '@/composables/useToast.js';

const router = useRouter();
const authStore = useAuthStore();

const stepItems = [
  { title: 'База данных', value: 1 },
  { title: 'Администратор', value: 2 },
  { title: 'Хранилище', value: 3 },
  { title: 'Готово', value: 4 }
];

const currentStep = ref(1);
const loading = ref(false);
const testLoading = ref(false);
const stepError = ref('');

// Step 0: Database
const dbType = ref('sqlite');
const dbFields = reactive({
  path: './data/gdd_support.sqlite',
  host: 'localhost',
  port: '5432',
  database: 'gdd_support',
  username: 'postgres',
  password: ''
});

// Step 1: Admin
const adminFields = reactive({
  login: '',
  email: '',
  displayName: '',
  password: '',
  passwordConfirm: ''
});
const adminErrors = reactive({ password: '', passwordConfirm: '' });

// Step 2: Storage
const storagePath = ref('');
const storageError = ref('');

onMounted(async () => {
  try {
    const res = await fetch('/api/setup/status');
    const { data } = await res.json();
    if (data.isComplete) { router.replace('/login'); return; }

    const steps = data.completedSteps || [];
    if (steps.includes('storage')) currentStep.value = 4;
    else if (steps.includes('admin')) currentStep.value = 3;
    else if (steps.includes('database')) currentStep.value = 2;
  } catch { /* stay on step 1 */ }
});

function buildDbBody() {
  if (dbType.value === 'sqlite') {
    return { dbType: 'sqlite', path: dbFields.path };
  }
  return {
    dbType: 'postgres',
    host: dbFields.host,
    port: parseInt(dbFields.port) || 5432,
    database: dbFields.database,
    username: dbFields.username,
    password: dbFields.password
  };
}

async function testDatabase() {
  testLoading.value = true;
  stepError.value = '';
  try {
    const body = buildDbBody();
    const res = await fetch('/api/setup/step/database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      stepError.value = data.error?.message || 'Ошибка подключения';
      toast.error(data.error?.message || 'Ошибка подключения');
    } else {
      toast.success('Подключение успешно!');
    }
  } catch {
    toast.error('Ошибка сети');
  }
  testLoading.value = false;
}

async function submitDatabase() {
  loading.value = true;
  stepError.value = '';
  try {
    const body = buildDbBody();
    const res = await fetch('/api/setup/step/database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      stepError.value = data.error?.message || 'Ошибка';
      toast.error(data.error?.message || 'Ошибка');
      loading.value = false;
      return;
    }
    toast.success(data.data.message);
    currentStep.value = 2;
  } catch {
    toast.error('Ошибка сети');
  }
  loading.value = false;
}

async function submitAdmin() {
  adminErrors.password = '';
  adminErrors.passwordConfirm = '';
  stepError.value = '';

  if (adminFields.password !== adminFields.passwordConfirm) {
    adminErrors.passwordConfirm = 'Пароли не совпадают';
    return;
  }
  if (adminFields.password.length < 8) {
    adminErrors.password = 'Минимум 8 символов';
    return;
  }

  loading.value = true;
  try {
    const res = await fetch('/api/setup/step/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: adminFields.login,
        email: adminFields.email,
        displayName: adminFields.displayName,
        password: adminFields.password
      })
    });
    const data = await res.json();
    if (!res.ok) {
      stepError.value = data.error?.message || 'Ошибка';
      toast.error(data.error?.message || 'Ошибка');
      loading.value = false;
      return;
    }
    toast.success(data.data.message);
    currentStep.value = 3;
  } catch {
    toast.error('Ошибка сети');
  }
  loading.value = false;
}

async function submitStorage() {
  storageError.value = '';
  stepError.value = '';
  if (!storagePath.value.trim()) {
    storageError.value = 'Укажите путь';
    return;
  }

  loading.value = true;
  try {
    const res = await fetch('/api/setup/step/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath: storagePath.value })
    });
    const data = await res.json();
    if (!res.ok) {
      stepError.value = data.error?.message || 'Ошибка';
      toast.error(data.error?.message || 'Ошибка');
      loading.value = false;
      return;
    }
    toast.success(data.data.message);
    currentStep.value = 4;
  } catch {
    toast.error('Ошибка сети');
  }
  loading.value = false;
}

async function submitComplete() {
  loading.value = true;
  stepError.value = '';
  try {
    const res = await fetch('/api/setup/step/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok) {
      stepError.value = data.error?.message || 'Ошибка';
      toast.error(data.error?.message || 'Ошибка');
      loading.value = false;
      return;
    }

    const { accessToken, user } = data.data;
    if (accessToken) {
      api.setToken(accessToken);
      authStore.user = user;
    }
    toast.success('Настройка завершена! Добро пожаловать!');
    setTimeout(() => router.push('/'), 1000);
  } catch {
    toast.error('Ошибка сети');
    loading.value = false;
  }
}
</script>
