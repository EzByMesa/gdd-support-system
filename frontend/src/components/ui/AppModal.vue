<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click="$emit('close')"></div>
    <div class="modal" @click.stop>
      <div class="modal__header">
        <h2>{{ title }}</h2>
        <button class="modal__close" @click="$emit('close')">&times;</button>
      </div>
      <div class="modal__body">
        <slot />
      </div>
      <div class="modal__footer">
        <slot name="footer" />
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';

defineProps({
  title: { type: String, default: '' }
});

const emit = defineEmits(['close']);

function onKeyDown(e) {
  if (e.key === 'Escape') emit('close');
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown);
  document.body.style.overflow = 'hidden';
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown);
  document.body.style.overflow = '';
});
</script>
