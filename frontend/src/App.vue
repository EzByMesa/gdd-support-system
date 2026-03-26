<template>
  <v-app>
    <v-main v-if="initError" class="d-flex align-center justify-center" style="min-height: 100vh">
      <v-card max-width="400" class="text-center pa-8" rounded="xl">
        <v-icon size="64" color="error" class="mb-4">mdi-server-off</v-icon>
        <h2 class="mb-2">Сервер недоступен</h2>
        <p class="text-medium-emphasis">Не удалось подключиться к серверу. Попробуйте позже.</p>
      </v-card>
    </v-main>

    <router-view v-else-if="ready" />

    <v-main v-else class="d-flex align-center justify-center" style="min-height: 100vh">
      <v-progress-circular indeterminate color="primary" size="48" />
    </v-main>

    <!-- Global snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="snackbar.timeout"
      location="top right" rounded="lg">
      {{ snackbar.text }}
      <template #actions>
        <v-btn icon="mdi-close" variant="text" size="small" @click="snackbar.show = false" />
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup>
import { ref, onMounted, provide } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { useNotificationStore } from '@/stores/notifications.js';
import config from '@/config.js';

const router = useRouter();
const authStore = useAuthStore();
const notifStore = useNotificationStore();

const ready = ref(false);
const initError = ref(false);

// Global snackbar
const snackbar = ref({ show: false, text: '', color: 'success', timeout: 4000 });

function showSnack(text, color = 'success', timeout = 4000) {
  snackbar.value = { show: true, text, color, timeout };
}

provide('snackbar', { show: showSnack });

onMounted(async () => {
  // Проверяем настройку системы
  try {
    const res = await fetch(`${config.apiUrl}/setup/status`);
    if (res.ok) {
      const { data } = await res.json();
      if (data.needsSetup) {
        ready.value = true;
        router.replace('/setup');
        return;
      }
    } else if (res.status === 503) {
      ready.value = true;
      router.replace('/setup');
      return;
    }
  } catch {
    initError.value = true;
    return;
  }

  // Восстановление сессии
  await authStore.tryRestore();

  ready.value = true;

  // Если авторизован — инициализируем уведомления + загружаем флаги
  if (authStore.isAuthenticated) {
    await notifStore.init();
    // Загружаем feature flags
    try {
      const res = await fetch(`${config.apiUrl}/auth/providers`);
      if (res.ok) {
        const json = await res.json();
        authStore.knowledgeEnabled = json.knowledgeEnabled === true;
      }
    } catch { /* */ }
  }

  // Редирект на login НЕ делаем здесь — router guard сам разберётся
});
</script>
