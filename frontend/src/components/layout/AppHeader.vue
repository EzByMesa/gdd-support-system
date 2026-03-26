<template>
  <header class="header">
    <button v-if="showBurger" class="header__burger" @click="$emit('burgerClick')">&equiv;</button>

    <router-link class="header__logo" :to="adminMode ? '/admin/dashboard' : '/'">
      {{ adminMode ? 'GDD Админ' : 'GDD Служба поддержки' }}
    </router-link>

    <div class="header__actions">
      <!-- Admin link -->
      <button v-if="authStore.isAdmin && !adminMode" class="header__icon-btn" title="Админ-панель"
        @click="router.push('/admin/dashboard')">&cong;</button>

      <!-- Bell -->
      <button ref="bellRef" class="header__icon-btn" title="Уведомления" @click="toggleNotif">
        &#128276;
        <span v-if="notifStore.unreadCount > 0" class="badge--count">
          {{ notifStore.unreadCount > 99 ? '99+' : notifStore.unreadCount }}
        </span>
      </button>

      <!-- Delegations (agents) -->
      <router-link v-if="authStore.isAgent || authStore.isAdmin" to="/delegations"
        class="header__icon-btn" title="Делегирование">
        &lrarr;
        <span v-if="delegCount > 0" class="badge--count">{{ delegCount }}</span>
      </router-link>

      <!-- User -->
      <div v-if="authStore.user" class="header__user">
        <div class="header__avatar">{{ initials }}</div>
        <span class="header__username">{{ authStore.user.displayName }}</span>
      </div>

      <button class="btn btn--ghost btn--sm" @click="handleLogout">Выход</button>
    </div>

    <NotificationDropdown v-if="notifOpen" :anchor-el="bellRef" @close="notifOpen = false" />
  </header>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { useNotificationStore } from '@/stores/notifications.js';
import { api } from '@/services/api.js';
import NotificationDropdown from '@/components/notifications/NotificationDropdown.vue';

defineProps({
  showBurger: { type: Boolean, default: false },
  adminMode: { type: Boolean, default: false }
});

defineEmits(['burgerClick']);

const router = useRouter();
const authStore = useAuthStore();
const notifStore = useNotificationStore();

const bellRef = ref(null);
const notifOpen = ref(false);
const delegCount = ref(0);

const initials = computed(() => {
  if (!authStore.user) return '';
  return authStore.user.displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
});

function toggleNotif() {
  notifOpen.value = !notifOpen.value;
}

async function handleLogout() {
  await authStore.logout();
  router.push('/login');
}

onMounted(async () => {
  if ((authStore.isAgent || authStore.isAdmin) && api.accessToken) {
    try {
      const res = await api.get('/delegations/incoming/count');
      delegCount.value = res.data?.count || 0;
    } catch { /* silent */ }
  }
});
</script>
