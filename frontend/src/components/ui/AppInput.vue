<template>
  <div class="input-group">
    <label v-if="label" :for="name">{{ label }}{{ required ? ' *' : '' }}</label>
    <input :class="['input', { 'input--error': !!error }]" :type="type" :name="name"
      :placeholder="placeholder" :value="modelValue" :required="required" :readonly="readonly"
      @input="$emit('update:modelValue', $event.target.value)" />
    <span v-if="error" class="input-error-text">{{ error }}</span>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, default: '' },
  type: { type: String, default: 'text' },
  name: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  modelValue: { type: [String, Number], default: '' },
  required: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  error: { type: String, default: '' }
});

defineEmits(['update:modelValue']);
</script>
