<template>
  <div>
    <input ref="fileInput" type="file" :multiple="multiple" :accept="accept"
      style="display: none" @change="onFileSelect" />
    <div :class="['file-upload', { 'file-upload--dragover': dragging }]"
      @click="fileInput.click()"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop">
      <div class="file-upload__text">
        <span>Нажмите</span> или перетащите файлы сюда
      </div>
    </div>
    <div v-if="files.length" class="flex-col gap-xs mt-sm">
      <div v-for="(file, i) in files" :key="i"
        class="flex items-center justify-between gap-sm"
        style="font-size: var(--font-size-sm)">
        <span>{{ file.name }} ({{ formatFileSize(file.size) }})</span>
        <button class="btn btn--ghost btn--sm" @click="removeFile(i)">&times;</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { formatFileSize } from '@/utils/format.js';

defineProps({
  multiple: { type: Boolean, default: true },
  accept: { type: String, default: '' }
});

const files = ref([]);
const dragging = ref(false);
const fileInput = ref(null);

function onFileSelect(e) {
  addFiles(e.target.files);
}

function onDrop(e) {
  dragging.value = false;
  addFiles(e.dataTransfer.files);
}

function addFiles(fileList) {
  files.value.push(...Array.from(fileList));
}

function removeFile(index) {
  files.value.splice(index, 1);
}

function getFiles() {
  return files.value;
}

function clear() {
  files.value = [];
  if (fileInput.value) fileInput.value.value = '';
}

defineExpose({ getFiles, clear });
</script>
