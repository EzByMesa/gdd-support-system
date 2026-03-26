<template>
  <div class="py-3 setting-row">
    <div class="mb-2">
      <div class="font-weight-medium">{{ label }}</div>
      <div v-if="desc" class="text-body-2 text-medium-emphasis">{{ desc }}</div>
    </div>
    <div>
      <v-switch
        v-if="type === 'toggle'"
        :model-value="value"
        color="primary"
        hide-details
        inset
        density="compact"
        @update:model-value="$emit('save', $event)"
      />
      <v-text-field
        v-else
        :model-value="value ?? ''"
        :type="type === 'password' ? 'password' : type === 'number' ? 'number' : 'text'"
        :readonly="readonly"
        variant="outlined"
        density="comfortable"
        hide-details
        @blur="$emit('save', $event.target.value)"
      />
    </div>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  desc: { type: String, default: '' },
  value: { default: null },
  type: { type: String, default: 'text' },
  readonly: { type: Boolean, default: false }
});

defineEmits(['save']);
</script>

<style scoped>
.setting-row + .setting-row {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
</style>
