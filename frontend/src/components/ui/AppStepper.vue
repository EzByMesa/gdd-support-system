<template>
  <div class="stepper">
    <template v-for="(label, i) in steps" :key="i">
      <div v-if="i > 0" :class="['stepper__line', { 'stepper__line--completed': i <= current }]"></div>
      <div :class="['stepper__step', {
        'stepper__step--active': i === current,
        'stepper__step--completed': i < current
      }]">
        <div class="stepper__circle">{{ i < current ? '\u2713' : i + 1 }}</div>
        <span class="stepper__label">{{ label }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
defineProps({
  steps: { type: Array, required: true },
  current: { type: Number, default: 0 }
});
</script>
