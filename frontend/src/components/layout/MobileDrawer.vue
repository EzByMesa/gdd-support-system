<template>
  <Teleport to="body">
    <div class="drawer-backdrop" @click="$emit('close')"></div>
    <div class="drawer">
      <div class="drawer__header">
        <span style="font-weight: var(--font-weight-semibold); font-size: var(--font-size-lg)">{{ title }}</span>
        <button class="drawer__close" @click="$emit('close')">&times;</button>
      </div>
      <nav class="admin-sidebar__nav">
        <template v-for="item in items" :key="item.path">
          <a v-if="item.external" :href="item.path" target="_blank"
            class="admin-sidebar__link" style="color: var(--color-primary)" @click="$emit('close')">
            <span class="admin-sidebar__icon">{{ item.icon }}</span>
            {{ item.label }}
          </a>
          <router-link v-else :to="item.path"
            class="admin-sidebar__link"
            :class="{ 'admin-sidebar__link--active': isActive(item.path) }"
            @click="$emit('close')">
            <span class="admin-sidebar__icon">{{ item.icon }}</span>
            {{ item.label }}
          </router-link>
        </template>
      </nav>
    </div>
  </Teleport>
</template>

<script setup>
import { useRoute } from 'vue-router';

defineProps({
  title: { type: String, default: 'Меню' },
  items: { type: Array, default: () => [] }
});

defineEmits(['close']);

const route = useRoute();

function isActive(path) {
  return route.path === path || route.path.startsWith(path + '/');
}
</script>
