<template>
  <aside class="admin-sidebar">
    <nav class="admin-sidebar__nav">
      <router-link v-for="item in navItems" :key="item.path" :to="item.path"
        class="admin-sidebar__link"
        :class="{ 'admin-sidebar__link--active': isActive(item.path) }">
        <span class="admin-sidebar__icon">{{ item.icon }}</span>
        {{ item.label }}
      </router-link>
    </nav>
    <div class="admin-sidebar__footer">
      <a class="admin-sidebar__link" href="/api/docs" target="_blank" style="color: var(--color-primary)">
        <span class="admin-sidebar__icon">&#128214;</span>
        API Документация
      </a>
      <router-link class="admin-sidebar__link" to="/">
        <span class="admin-sidebar__icon">&larr;</span>
        На сайт
      </router-link>
    </div>
  </aside>
</template>

<script setup>
import { useRoute } from 'vue-router';

const route = useRoute();

const navItems = [
  { path: '/admin/dashboard', icon: '\uD83D\uDCCA', label: 'Дашборд' },
  { path: '/admin/users', icon: '\uD83D\uDC65', label: 'Пользователи' },
  { path: '/admin/tickets', icon: '\uD83C\uDFAB', label: 'Тикеты' },
  { path: '/admin/topic-groups', icon: '\uD83D\uDCC2', label: 'Тематики' },
  { path: '/admin/custom-fields', icon: '\uD83D\uDCDD', label: 'Поля формы' },
  { path: '/admin/auth', icon: '\uD83D\uDD10', label: 'Авторизация' },
  { path: '/admin/settings', icon: '\u2699\uFE0F', label: 'Настройки' }
];

function isActive(path) {
  return route.path === path || route.path.startsWith(path + '/');
}
</script>
