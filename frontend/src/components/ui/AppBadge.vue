<template>
  <span :class="['badge', variant ? `badge--${variant}` : '']">
    <slot>{{ text }}</slot>
  </span>
</template>

<script setup>
defineProps({
  text: { type: String, default: '' },
  variant: { type: String, default: '' }
});
</script>
