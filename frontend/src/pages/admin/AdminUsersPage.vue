<template>
  <AdminLayout>
    <v-container fluid>
      <div class="d-flex align-center justify-space-between mb-6">
        <div class="text-h5 font-weight-bold">Пользователи</div>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateModal = true">
          Создать
        </v-btn>
      </div>

      <v-row class="mb-4">
        <v-col cols="12" sm="8">
          <v-text-field
            v-model="search"
            prepend-inner-icon="mdi-magnify"
            placeholder="Поиск по имени, логину, email..."
            variant="outlined"
            density="compact"
            hide-details
            clearable
            @update:model-value="debounceLoad"
          />
        </v-col>
        <v-col cols="12" sm="4">
          <v-select
            v-model="roleFilter"
            :items="roleOptions"
            item-title="text"
            item-value="value"
            variant="outlined"
            density="compact"
            hide-details
            @update:model-value="page = 1; load()"
          />
        </v-col>
      </v-row>

      <v-row v-if="loading" justify="center" class="my-10">
        <v-progress-circular indeterminate color="primary" size="48" />
      </v-row>

      <v-alert v-else-if="users.length === 0" type="info" variant="tonal">
        Нет пользователей
      </v-alert>

      <div v-else class="d-flex flex-column" style="gap: 8px">
        <v-card v-for="u in users" :key="u.id" variant="outlined">
          <v-card-text class="d-flex align-center justify-space-between flex-wrap" style="gap: 12px">
            <div class="d-flex align-center" style="gap: 12px; flex: 1; min-width: 200px">
              <v-avatar color="primary" size="40">
                <span class="text-white text-body-2 font-weight-bold">{{ getInitials(u.displayName) }}</span>
              </v-avatar>
              <div>
                <div class="font-weight-medium">
                  {{ u.displayName }}
                  <span v-if="u.isRootAdmin" class="text-caption text-medium-emphasis ml-1">(root)</span>
                </div>
                <div class="text-caption text-medium-emphasis">
                  @{{ u.login }}{{ u.email ? ` \u00B7 ${u.email}` : '' }}
                </div>
              </div>
            </div>

            <div class="d-flex align-center" style="gap: 8px">
              <v-chip :color="roleColors[u.role]" size="small" label>
                {{ roleLabels[u.role] }}
              </v-chip>
              <v-chip v-if="!u.isActive" color="error" size="small" label variant="outlined">
                Неактивен
              </v-chip>
            </div>

            <div class="d-flex align-center" style="gap: 8px">
              <v-select
                :model-value="u.role"
                :items="roleSelectItems"
                item-title="text"
                item-value="value"
                variant="outlined"
                density="compact"
                hide-details
                style="max-width: 180px"
                @update:model-value="changeRole(u.id, $event)"
              />
              <v-btn
                :icon="u.isActive ? 'mdi-account-off-outline' : 'mdi-account-check-outline'"
                :color="u.isActive ? 'default' : 'success'"
                variant="text"
                size="small"
                :title="u.isActive ? 'Деактивировать' : 'Активировать'"
                @click="toggleActive(u.id, !u.isActive)"
              />
              <v-btn
                v-if="!u.isRootAdmin"
                icon="mdi-delete-outline"
                color="error"
                variant="text"
                size="small"
                title="Удалить"
                @click="deleteUser(u)"
              />
            </div>
          </v-card-text>
        </v-card>
      </div>

      <!-- Create User Dialog -->
      <v-dialog v-model="showCreateModal" max-width="500" persistent>
        <v-card>
          <v-card-title class="text-h6">Создать пользователя</v-card-title>
          <v-card-text>
            <v-form ref="createFormRef" class="d-flex flex-column" style="gap: 16px">
              <v-text-field
                v-model="createForm.login"
                label="Логин"
                variant="outlined"
                density="compact"
                :rules="[v => !!v || 'Обязательное поле']"
              />
              <v-text-field
                v-model="createForm.displayName"
                label="Имя"
                variant="outlined"
                density="compact"
                :rules="[v => !!v || 'Обязательное поле']"
              />
              <v-text-field
                v-model="createForm.email"
                label="Email"
                type="email"
                variant="outlined"
                density="compact"
              />
              <v-text-field
                v-model="createForm.password"
                label="Пароль"
                type="password"
                variant="outlined"
                density="compact"
                :rules="[v => !!v || 'Обязательное поле']"
              />
              <v-select
                v-model="createForm.role"
                :items="roleSelectItems"
                item-title="text"
                item-value="value"
                label="Роль"
                variant="outlined"
                density="compact"
              />
            </v-form>
          </v-card-text>
          <v-card-actions class="px-4 pb-4">
            <v-spacer />
            <v-btn variant="text" @click="showCreateModal = false">Отмена</v-btn>
            <v-btn color="primary" :loading="createLoading" @click="createUser">Создать</v-btn>
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

const users = ref([]);
const search = ref('');
const roleFilter = ref('');
const page = ref(1);
const loading = ref(false);
const showCreateModal = ref(false);
const createLoading = ref(false);
const createFormRef = ref(null);

const roleOptions = [
  { value: '', text: 'Все роли' },
  { value: 'USER', text: 'Пользователь' },
  { value: 'AGENT', text: 'Агент' },
  { value: 'SENIOR_AGENT', text: 'Старший агент' },
  { value: 'ADMIN', text: 'Администратор' }
];

const roleSelectItems = [
  { value: 'USER', text: 'Пользователь' },
  { value: 'AGENT', text: 'Агент' },
  { value: 'SENIOR_AGENT', text: 'Старший агент' },
  { value: 'ADMIN', text: 'Администратор' }
];

const roleColors = { ADMIN: 'orange', SENIOR_AGENT: 'teal', AGENT: 'blue', USER: 'grey' };
const roleLabels = { ADMIN: 'Администратор', SENIOR_AGENT: 'Старший агент', AGENT: 'Агент', USER: 'Пользователь' };

const createForm = reactive({
  login: '', displayName: '', email: '', password: '', role: 'USER'
});

let debounceTimer;
function debounceLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { page.value = 1; load(); }, 300);
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

async function load() {
  loading.value = true;
  try {
    const query = { page: page.value, limit: 20 };
    if (search.value) query.search = search.value;
    if (roleFilter.value) query.role = roleFilter.value;
    const res = await api.get('/admin/users', query);
    users.value = res.data || [];
  } catch (err) { toast.error(err.message); }
  loading.value = false;
}

async function changeRole(userId, role) {
  try {
    await api.put(`/admin/users/${userId}/role`, { role });
    toast.success('Роль изменена');
    await load();
  } catch (err) { toast.error(err.message); }
}

async function toggleActive(userId, isActive) {
  try {
    await api.put(`/admin/users/${userId}/active`, { isActive });
    toast.success(isActive ? 'Активирован' : 'Деактивирован');
    await load();
  } catch (err) { toast.error(err.message); }
}

async function deleteUser(u) {
  if (!confirm(`Удалить пользователя "${u.displayName}" (@${u.login})?\n\nЭто деактивирует учётную запись.`)) return;
  try {
    await api.delete(`/admin/users/${u.id}`);
    toast.success('Пользователь удалён');
    await load();
  } catch (err) { toast.error(err.message); }
}

async function createUser() {
  createLoading.value = true;
  try {
    await api.post('/admin/users', createForm);
    toast.success('Пользователь создан');
    showCreateModal.value = false;
    Object.assign(createForm, { login: '', displayName: '', email: '', password: '', role: 'USER' });
    await load();
  } catch (err) {
    toast.error(err.message);
  }
  createLoading.value = false;
}

onMounted(load);
</script>
