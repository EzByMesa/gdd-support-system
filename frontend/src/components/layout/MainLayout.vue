<template>
  <v-app>
    <!-- Sticky header with animated gradient -->
    <v-app-bar class="bg-gradient-header" density="compact" flat style="position: sticky; top: 0; z-index: 100;">
      <v-app-bar-nav-icon v-if="isMobile" @click="mobileDrawer = true" size="small" />

      <router-link to="/" class="d-flex align-center text-decoration-none ml-2" style="gap: 6px">
        <v-icon color="white" size="20">mdi-headset</v-icon>
        <span class="font-weight-bold text-white text-body-2">GDD</span>
      </router-link>

      <v-spacer />

      <!-- Desktop nav -->
      <template v-if="!isMobile && authStore.isAuthenticated">
        <v-btn variant="text" color="white" to="/" size="small" class="text-none">
          Обращения
        </v-btn>
        <v-btn v-if="authStore.isAgent || authStore.isAdmin"
          variant="text" color="white" to="/delegations" size="small" class="text-none">
          <v-badge v-if="delegCount > 0" :content="delegCount" color="warning" floating dot>
            <span>Делегирование</span>
          </v-badge>
          <span v-else>Делегирование</span>
        </v-btn>
        <v-btn v-if="authStore.isAdmin"
          variant="text" color="white" to="/admin" size="small" class="text-none">
          Админ
        </v-btn>
      </template>

      <v-spacer v-if="isMobile" />

      <!-- Bell -->
      <v-btn v-if="authStore.isAuthenticated"
        icon variant="text" color="white" size="small" @click="notifOpen = !notifOpen" id="bell-btn">
        <v-badge v-if="notifStore.unreadCount > 0"
          :content="notifStore.unreadCount" color="error" floating>
          <v-icon size="20">mdi-bell</v-icon>
        </v-badge>
        <v-icon v-else size="20">mdi-bell-outline</v-icon>
      </v-btn>

      <!-- User menu -->
      <v-menu v-if="authStore.user" location="bottom end">
        <template #activator="{ props }">
          <v-btn v-bind="props" variant="text" size="small" class="text-none ml-1" rounded="xl">
            <v-avatar size="26" :color="avatarColor">
              <span class="text-caption font-weight-bold" style="color: #121318">{{ initials }}</span>
            </v-avatar>
            <v-icon size="14" class="ml-1" color="white">mdi-chevron-down</v-icon>
          </v-btn>
        </template>
        <v-card min-width="180" rounded="lg" color="surface-light">
          <v-list density="compact" nav bg-color="transparent">
            <v-list-item class="px-3 py-2">
              <div class="text-body-2 font-weight-bold">{{ authStore.user.displayName }}</div>
              <div class="text-caption" style="color: rgba(255,255,255,0.4)">{{ roleLabel }}</div>
            </v-list-item>
            <v-divider class="my-1" />
            <v-list-item to="/profile" prepend-icon="mdi-account-cog" title="Личный кабинет" density="compact" />
            <v-list-item @click="handleLogout" prepend-icon="mdi-logout" title="Выход" density="compact" />
          </v-list>
        </v-card>
      </v-menu>
    </v-app-bar>

    <!-- Mobile drawer -->
    <v-navigation-drawer v-model="mobileDrawer" temporary width="260" color="surface">
      <v-list density="compact" nav class="pa-2">
        <v-list-item to="/" prepend-icon="mdi-ticket-outline" title="Обращения" />
        <v-list-item to="/tickets/new" prepend-icon="mdi-plus" title="Новое обращение" />
        <v-list-item v-if="authStore.isAgent || authStore.isAdmin"
          to="/delegations" prepend-icon="mdi-swap-horizontal" title="Делегирование" />
        <v-list-item v-if="authStore.isAgent || authStore.isAdmin"
          to="/topic-groups" prepend-icon="mdi-folder-multiple" title="Тематики" />
        <v-divider class="my-1" />
        <v-list-item to="/profile" prepend-icon="mdi-account-cog" title="Личный кабинет" />
        <v-list-item v-if="authStore.isAdmin" to="/admin" prepend-icon="mdi-shield-crown" title="Админ-панель" />
        <v-divider class="my-1" />
        <v-list-item @click="handleLogout" prepend-icon="mdi-logout" title="Выход" />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container fluid class="pa-3 pa-md-4" style="max-width: 1200px">
        <slot />
      </v-container>
    </v-main>

    <!-- Notifications dialog -->
    <v-dialog v-model="notifOpen" :fullscreen="isMobile" :max-width="isMobile ? undefined : 420"
      :transition="isMobile ? 'dialog-bottom-transition' : 'dialog-transition'" scrollable>
      <v-card color="surface-light" :rounded="isMobile ? 0 : 'lg'" class="d-flex flex-column" style="max-height: 80vh">
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
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import { useAuthStore } from '@/stores/auth.js';
import { useNotificationStore } from '@/stores/notifications.js';
import { api } from '@/services/api.js';
import NotificationDropdown from '@/components/notifications/NotificationDropdown.vue';

const router = useRouter();
const authStore = useAuthStore();
const notifStore = useNotificationStore();
const { mobile: isMobile } = useDisplay();

const notifOpen = ref(false);
const delegCount = ref(0);
const mobileDrawer = ref(false);

const initials = computed(() => {
  if (!authStore.user) return '';
  return authStore.user.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
});

const roleLabels = { USER: 'Пользователь', AGENT: 'Агент', ADMIN: 'Администратор' };
const roleLabel = computed(() => roleLabels[authStore.user?.role] || '');
const avatarColor = computed(() => {
  const colors = ['#8B9DC3', '#B09AC5', '#7EA87E', '#C9A96E', '#BF7B7B', '#7E9BB5'];
  const name = authStore.user?.displayName || '';
  return colors[name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];
});

async function handleLogout() {
  await authStore.logout();
  router.push('/login');
}

onMounted(async () => {
  if ((authStore.isAgent || authStore.isAdmin) && api.accessToken) {
    try {
      const res = await api.get('/delegations/incoming/count');
      delegCount.value = res.data?.count || 0;
    } catch { /* */ }
  }
});
</script>
