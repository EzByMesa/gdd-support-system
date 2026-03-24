<template>
  <v-app>
    <v-navigation-drawer v-model="drawerOpen" :permanent="!mobile" :temporary="mobile"
      width="240" color="surface-light">
      <v-list-item title="GDD Admin" class="pa-3">
        <template #prepend>
          <v-icon color="primary" size="22">mdi-shield-crown</v-icon>
        </template>
      </v-list-item>
      <v-divider />
      <v-list density="compact" nav class="pa-2">
        <v-list-item v-for="item in navItems" :key="item.path" :to="item.path"
          :prepend-icon="item.icon" :title="item.label" :active="isActive(item.path)" rounded="lg" class="mb-1" />
      </v-list>
      <template #append>
        <v-divider />
        <v-list density="compact" nav class="pa-2">
          <v-list-item href="/api/docs" target="_blank" prepend-icon="mdi-book-open-variant"
            title="API Docs" rounded="lg" class="mb-1" />
          <v-list-item to="/" prepend-icon="mdi-arrow-left" title="На сайт" rounded="lg" />
        </v-list>
      </template>
    </v-navigation-drawer>

    <v-app-bar class="bg-gradient-header" density="compact" flat>
      <v-app-bar-nav-icon size="small" @click="drawerOpen = !drawerOpen" />
      <v-app-bar-title>
        <router-link to="/admin/dashboard" class="text-white text-decoration-none text-body-2 font-weight-bold">
          GDD Admin
        </router-link>
      </v-app-bar-title>
      <v-spacer />

      <!-- Bell -->
      <v-btn icon variant="text" size="small" @click="notifOpen = true">
        <v-badge v-if="notifStore.unreadCount > 0" :content="notifStore.unreadCount" color="error" floating>
          <v-icon size="20">mdi-bell</v-icon>
        </v-badge>
        <v-icon v-else size="20">mdi-bell-outline</v-icon>
      </v-btn>

      <!-- User -->
      <v-menu v-if="authStore.user" location="bottom end">
        <template #activator="{ props }">
          <v-btn v-bind="props" variant="text" size="small" class="text-none ml-1" rounded="xl">
            <v-avatar size="26" color="secondary">
              <span class="text-caption font-weight-bold" style="color: #121318">{{ initials }}</span>
            </v-avatar>
            <v-icon size="14" class="ml-1" color="white">mdi-chevron-down</v-icon>
          </v-btn>
        </template>
        <v-card min-width="180" rounded="lg" color="surface-light">
          <v-list density="compact" nav bg-color="transparent">
            <v-list-item to="/profile" prepend-icon="mdi-account-cog" title="Личный кабинет" density="compact" />
            <v-divider />
            <v-list-item @click="handleLogout" prepend-icon="mdi-logout" title="Выход" density="compact" />
          </v-list>
        </v-card>
      </v-menu>
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-3 pa-md-4">
        <slot />
      </v-container>
    </v-main>

    <!-- Notifications dialog (same as MainLayout) -->
    <v-dialog v-model="notifOpen" :fullscreen="mobile" :max-width="mobile ? undefined : 420"
      :transition="mobile ? 'dialog-bottom-transition' : 'dialog-transition'" scrollable>
      <v-card color="surface-light" :rounded="mobile ? 0 : 'lg'" class="d-flex flex-column" style="max-height: 80vh">
        <v-card-title class="d-flex align-center justify-space-between py-2 px-4">
          <span class="text-body-1 font-weight-bold">Уведомления</span>
          <v-btn icon variant="text" size="small" @click="notifOpen = false">
            <v-icon size="18">mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider />
        <NotificationDropdown @close="notifOpen = false" />
      </v-card>
    </v-dialog>
  </v-app>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import { useAuthStore } from '@/stores/auth.js';
import { useNotificationStore } from '@/stores/notifications.js';
import NotificationDropdown from '@/components/notifications/NotificationDropdown.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notifStore = useNotificationStore();
const { mobile } = useDisplay();

const drawerOpen = ref(true);
const notifOpen = ref(false);

const navItems = [
  { path: '/admin/dashboard', icon: 'mdi-view-dashboard', label: 'Дашборд' },
  { path: '/admin/users', icon: 'mdi-account-group', label: 'Пользователи' },
  { path: '/admin/tickets', icon: 'mdi-ticket', label: 'Тикеты' },
  { path: '/admin/topic-groups', icon: 'mdi-folder', label: 'Тематики' },
  { path: '/admin/custom-fields', icon: 'mdi-form-textbox', label: 'Поля формы' },
  { path: '/admin/auth', icon: 'mdi-lock', label: 'Авторизация' },
  { path: '/admin/settings', icon: 'mdi-cog', label: 'Настройки' }
];

const initials = computed(() => {
  if (!authStore.user) return '';
  return authStore.user.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
});

function isActive(path) {
  return route.path === path || route.path.startsWith(path + '/');
}

async function handleLogout() {
  await authStore.logout();
  router.push('/login');
}
</script>
