<template>
  <div class="spinner-container">
    <div :class="['spinner', size !== 'md' ? `spinner--${size}` : '']"></div>
  </div>
</template>

<script setup>
defineProps({
  size: { type: String, default: 'md' }
});
</script>
