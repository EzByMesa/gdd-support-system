<template>
  <button :class="classes" :type="type" :disabled="disabled || loading" @click="$emit('click', $event)">
    <slot>{{ text }}</slot>
  </button>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  text: { type: String, default: '' },
  variant: { type: String, default: 'primary' },
  size: { type: String, default: null },
  block: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  type: { type: String, default: 'button' }
});

defineEmits(['click']);

const classes = computed(() => {
  const c = ['btn', `btn--${props.variant}`];
  if (props.size) c.push(`btn--${props.size}`);
  if (props.block) c.push('btn--block');
  if (props.loading) c.push('btn--loading');
  return c;
});
</script>
