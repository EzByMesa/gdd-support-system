<template>
  <div class="input-group">
    <label v-if="label" :for="name">{{ label }}</label>
    <select :class="['select']" :name="name" :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)">
      <option v-if="placeholder" value="" disabled :selected="!modelValue">{{ placeholder }}</option>
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.text }}</option>
    </select>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, default: '' },
  name: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  modelValue: { type: [String, Number], default: '' },
  placeholder: { type: String, default: '' }
});

defineEmits(['update:modelValue']);
</script>
