<template>
  <MainLayout>
    <!-- Page header -->
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h5 font-weight-bold">Новое обращение</h1>
      <v-btn variant="text" prepend-icon="mdi-arrow-left" @click="router.push('/')">
        Назад
      </v-btn>
    </div>

    <v-card class="pa-6">
      <v-form @submit.prevent="handleSubmit">
        <v-text-field
          v-model="form.title"
          label="Тема обращения"
          placeholder="Кратко опишите проблему"
          :error-messages="errors.title"
          required
          variant="outlined"
          class="mb-2"
        />

        <v-textarea
          v-model="form.description"
          label="Описание"
          placeholder="Подробно опишите вашу проблему или запрос..."
          :error-messages="errors.description"
          required
          rows="6"
          variant="outlined"
          class="mb-2"
        />

        <v-select
          v-model="form.priority"
          :items="priorityOptions"
          item-title="text"
          item-value="value"
          label="Приоритет"
          variant="outlined"
          class="mb-2"
        />

        <!-- Custom Fields -->
        <template v-for="field in customFields" :key="field.id">
          <!-- Text -->
          <v-text-field
            v-if="field.type === 'text'"
            v-model="customValues[field.fieldKey]"
            :label="field.name + (field.required ? ' *' : '')"
            :error-messages="customErrors[field.fieldKey]"
            variant="outlined"
            class="mb-2"
          />

          <!-- Textarea -->
          <v-textarea
            v-else-if="field.type === 'textarea'"
            v-model="customValues[field.fieldKey]"
            :label="field.name + (field.required ? ' *' : '')"
            :error-messages="customErrors[field.fieldKey]"
            rows="3"
            variant="outlined"
            class="mb-2"
          />

          <!-- Number -->
          <v-text-field
            v-else-if="field.type === 'number'"
            v-model="customValues[field.fieldKey]"
            type="number"
            :label="field.name + (field.required ? ' *' : '')"
            :error-messages="customErrors[field.fieldKey]"
            variant="outlined"
            class="mb-2"
          />

          <!-- Select -->
          <v-select
            v-else-if="field.type === 'select'"
            v-model="customValues[field.fieldKey]"
            :items="(field.options || []).map(o => ({ title: o, value: o }))"
            item-title="title"
            item-value="value"
            :label="field.name + (field.required ? ' *' : '')"
            placeholder="Выберите..."
            variant="outlined"
            class="mb-2"
          />

          <!-- Date -->
          <v-text-field
            v-else-if="field.type === 'date'"
            v-model="customValues[field.fieldKey]"
            type="date"
            :label="field.name + (field.required ? ' *' : '')"
            :error-messages="customErrors[field.fieldKey]"
            variant="outlined"
            class="mb-2"
          />

          <!-- Checkbox -->
          <v-checkbox
            v-else-if="field.type === 'checkbox'"
            v-model="customValues[field.fieldKey]"
            :label="field.name + (field.required ? ' *' : '')"
            class="mb-2"
          />
        </template>

        <!-- File upload -->
        <v-file-input
          ref="fileInputRef"
          v-model="files"
          label="Вложения"
          multiple
          chips
          counter
          show-size
          prepend-icon="mdi-paperclip"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.7z,.txt"
          variant="outlined"
          class="mb-4"
        />

        <div class="d-flex justify-space-between">
          <v-btn variant="outlined" @click="router.push('/')">
            Отмена
          </v-btn>
          <v-btn color="primary" type="submit" :loading="loading">
            Создать обращение
          </v-btn>
        </div>
      </v-form>
    </v-card>
  </MainLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/services/api.js';
import { toast } from '@/composables/useToast.js';
import MainLayout from '@/components/layout/MainLayout.vue';

const router = useRouter();
const loading = ref(false);
const files = ref([]);
const fileInputRef = ref(null);
const customFields = ref([]);
const customValues = reactive({});
const customErrors = reactive({});

const form = reactive({
  title: '',
  description: '',
  priority: 'MEDIUM'
});

const errors = reactive({ title: '', description: '' });

const priorityOptions = [
  { value: 'LOW', text: 'Низкий' },
  { value: 'MEDIUM', text: 'Средний' },
  { value: 'HIGH', text: 'Высокий' },
  { value: 'CRITICAL', text: 'Критичный' }
];

async function loadCustomFields() {
  try {
    const res = await api.get('/tickets/custom-fields');
    customFields.value = res.data || [];
    // Устанавливаем значения по умолчанию
    for (const field of customFields.value) {
      if (field.defaultValue != null && field.defaultValue !== '') {
        if (field.type === 'checkbox') {
          customValues[field.fieldKey] = field.defaultValue === 'true';
        } else {
          customValues[field.fieldKey] = field.defaultValue;
        }
      } else {
        customValues[field.fieldKey] = field.type === 'checkbox' ? false : '';
      }
    }
  } catch {
    // Custom fields are optional
  }
}

async function handleSubmit() {
  errors.title = '';
  errors.description = '';
  // Clear custom errors
  for (const key of Object.keys(customErrors)) {
    customErrors[key] = '';
  }

  if (!form.title.trim()) { errors.title = 'Укажите тему'; return; }
  if (!form.description.trim()) { errors.description = 'Укажите описание'; return; }

  // Validate required custom fields
  let hasCustomError = false;
  for (const field of customFields.value) {
    if (field.required) {
      const val = customValues[field.fieldKey];
      if (val === undefined || val === null || val === '' || val === false) {
        customErrors[field.fieldKey] = `Поле "${field.name}" обязательно`;
        hasCustomError = true;
      }
    }
  }
  if (hasCustomError) return;

  loading.value = true;
  try {
    // Build custom fields data
    const cfData = {};
    let hasCustomData = false;
    for (const field of customFields.value) {
      const val = customValues[field.fieldKey];
      if (val !== undefined && val !== '' && val !== false) {
        cfData[field.fieldKey] = val;
        hasCustomData = true;
      }
    }

    const result = await api.post('/tickets', {
      title: form.title,
      description: form.description,
      priority: form.priority,
      customFields: hasCustomData ? cfData : null
    });

    const ticketId = result.data.id;

    // Upload files
    const uploadFiles = files.value || [];
    for (const file of uploadFiles) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('ticketId', ticketId);
      await api.upload('/attachments', fd);
    }

    toast.success('Обращение создано!');
    router.push(`/tickets/${ticketId}`);
  } catch (err) {
    toast.error(err.message || 'Ошибка создания');
    loading.value = false;
  }
}

onMounted(loadCustomFields);
</script>
