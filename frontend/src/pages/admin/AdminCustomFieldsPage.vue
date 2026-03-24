<template>
  <AdminLayout>
    <v-container fluid>
      <div class="d-flex align-center justify-space-between mb-6">
        <div class="text-h5 font-weight-bold">Пользовательские поля</div>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateModal">
          Добавить поле
        </v-btn>
      </div>

      <v-row v-if="loading" justify="center" class="my-10">
        <v-progress-circular indeterminate color="primary" size="48" />
      </v-row>

      <template v-else>
        <v-alert v-if="fields.length === 0" type="info" variant="tonal" class="mb-4">
          <template #prepend>
            <v-icon icon="mdi-form-textbox" />
          </template>
          <div>
            <div class="font-weight-medium">Нет пользовательских полей</div>
            <div class="text-body-2">Создайте поля, которые будут отображаться в форме создания обращения</div>
          </div>
        </v-alert>

        <template v-else>
          <div class="text-body-2 text-medium-emphasis mb-4">
            Перетащите поля для изменения порядка в форме тикета
          </div>

          <div class="d-flex flex-column" style="gap: 8px">
            <v-card
              v-for="(field, index) in fields"
              :key="field.id"
              variant="outlined"
              draggable="true"
              :class="{
                'dragging-card': dragIndex === index,
                'drag-over-card': dragOverIndex === index && dragOverIndex !== dragIndex
              }"
              @dragstart="onDragStart(index, $event)"
              @dragover.prevent="onDragOver(index, $event)"
              @dragenter.prevent
              @drop="onDrop(index)"
              @dragend="onDragEnd"
            >
              <v-card-text class="d-flex align-center" style="gap: 12px">
                <v-icon
                  icon="mdi-drag"
                  class="drag-handle"
                  style="cursor: grab; color: rgba(0,0,0,0.38)"
                  title="Перетащите для изменения порядка"
                />

                <div style="flex: 1; min-width: 0">
                  <div class="d-flex align-center" style="gap: 6px">
                    <span class="font-weight-bold">{{ field.name }}</span>
                    <v-chip v-if="field.required" color="error" size="x-small" label>
                      Обязательное
                    </v-chip>
                    <v-chip v-if="!field.isActive" color="grey" size="x-small" label variant="outlined">
                      Неактивно
                    </v-chip>
                  </div>
                  <div class="text-body-2 text-medium-emphasis mt-1">
                    Ключ: <code class="bg-grey-lighten-3 px-1 rounded">{{ field.fieldKey }}</code>
                    &middot; Тип: {{ fieldTypeLabels[field.type] || field.type }}
                    <template v-if="field.defaultValue"> &middot; По умолчанию: {{ field.defaultValue }}</template>
                    <template v-if="field.options?.length"> &middot; Опции: {{ field.options.join(', ') }}</template>
                  </div>
                </div>

                <div class="d-flex" style="gap: 4px">
                  <v-btn icon="mdi-pencil-outline" variant="text" size="small" @click="openEditModal(field)" />
                  <v-btn icon="mdi-delete-outline" variant="text" size="small" color="error" @click="deleteField(field)" />
                </div>
              </v-card-text>
            </v-card>
          </div>
        </template>
      </template>

      <!-- Create/Edit Dialog -->
      <v-dialog v-model="showModal" max-width="550" persistent>
        <v-card>
          <v-card-title class="text-h6">
            {{ editingField ? 'Редактировать поле' : 'Новое поле' }}
          </v-card-title>
          <v-card-text>
            <v-form ref="fieldFormRef" @submit.prevent="saveField">
              <div class="d-flex flex-column" style="gap: 16px">
                <v-text-field
                  v-model="form.name"
                  label="Название поля"
                  variant="outlined"
                  density="compact"
                  placeholder="Например: Номер договора"
                  :rules="[v => !!v || 'Обязательное поле']"
                />

                <v-text-field
                  v-if="!editingField"
                  v-model="form.fieldKey"
                  label="Ключ поля (латиница)"
                  variant="outlined"
                  density="compact"
                  placeholder="contract_number"
                  :rules="[v => !!v || 'Обязательное поле']"
                  :error-messages="formErrors.fieldKey ? [formErrors.fieldKey] : []"
                />

                <v-select
                  v-model="form.type"
                  :items="fieldTypeOptions"
                  item-title="text"
                  item-value="value"
                  label="Тип поля"
                  variant="outlined"
                  density="compact"
                />

                <div class="d-flex" style="gap: 16px">
                  <v-checkbox
                    v-model="form.required"
                    label="Обязательное"
                    density="compact"
                    hide-details
                  />
                  <v-checkbox
                    v-model="form.isActive"
                    label="Активно"
                    density="compact"
                    hide-details
                  />
                </div>

                <v-text-field
                  v-if="form.required"
                  v-model="form.defaultValue"
                  label="Значение по умолчанию"
                  variant="outlined"
                  density="compact"
                  placeholder="Для обязательных полей"
                />

                <v-textarea
                  v-if="form.type === 'select'"
                  v-model="optionsText"
                  label="Варианты выбора (по одному на строку)"
                  variant="outlined"
                  density="compact"
                  rows="4"
                  placeholder="Вариант 1&#10;Вариант 2&#10;Вариант 3"
                />
              </div>
            </v-form>
          </v-card-text>
          <v-card-actions class="px-4 pb-4">
            <v-spacer />
            <v-btn variant="text" @click="showModal = false">Отмена</v-btn>
            <v-btn color="primary" :loading="saving" @click="saveField">
              {{ editingField ? 'Сохранить' : 'Создать' }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </AdminLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { api } from '@/services/api.js';
import { toast } from '@/composables/useToast.js';
import AdminLayout from '@/components/layout/AdminLayout.vue';

const fields = ref([]);
const loading = ref(true);
const showModal = ref(false);
const editingField = ref(null);
const saving = ref(false);
const optionsText = ref('');
const fieldFormRef = ref(null);

const form = reactive({
  name: '',
  fieldKey: '',
  type: 'text',
  required: false,
  defaultValue: '',
  isActive: true
});

const formErrors = reactive({ fieldKey: '' });

const fieldTypeLabels = {
  text: 'Текст',
  textarea: 'Многострочный текст',
  number: 'Число',
  select: 'Список',
  date: 'Дата',
  checkbox: 'Флажок'
};

const fieldTypeOptions = [
  { value: 'text', text: 'Текст' },
  { value: 'textarea', text: 'Многострочный текст' },
  { value: 'number', text: 'Число' },
  { value: 'select', text: 'Список' },
  { value: 'date', text: 'Дата' },
  { value: 'checkbox', text: 'Флажок' }
];

// Drag & Drop
const dragIndex = ref(null);
const dragOverIndex = ref(null);

function onDragStart(index, e) {
  dragIndex.value = index;
  e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(index) {
  dragOverIndex.value = index;
}

function onDrop(toIndex) {
  const fromIndex = dragIndex.value;
  if (fromIndex === null || fromIndex === toIndex) return;

  const item = fields.value.splice(fromIndex, 1)[0];
  fields.value.splice(toIndex, 0, item);

  // Сохраняем новый порядок
  saveOrder();
}

function onDragEnd() {
  dragIndex.value = null;
  dragOverIndex.value = null;
}

async function saveOrder() {
  const order = fields.value.map((f, i) => ({ id: f.id, sortOrder: i }));
  try {
    const res = await api.put('/admin/custom-fields-reorder', { order });
    fields.value = res.data;
    toast.success('Порядок сохранён');
  } catch (err) {
    toast.error(err.message);
  }
}

function openCreateModal() {
  editingField.value = null;
  form.name = '';
  form.fieldKey = '';
  form.type = 'text';
  form.required = false;
  form.defaultValue = '';
  form.isActive = true;
  optionsText.value = '';
  formErrors.fieldKey = '';
  showModal.value = true;
}

function openEditModal(field) {
  editingField.value = field;
  form.name = field.name;
  form.fieldKey = field.fieldKey;
  form.type = field.type;
  form.required = field.required;
  form.defaultValue = field.defaultValue || '';
  form.isActive = field.isActive;
  optionsText.value = (field.options || []).join('\n');
  formErrors.fieldKey = '';
  showModal.value = true;
}

async function saveField() {
  formErrors.fieldKey = '';

  if (!editingField.value && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(form.fieldKey)) {
    formErrors.fieldKey = 'Только латиница, цифры и подчёркивания';
    return;
  }

  const body = {
    name: form.name,
    type: form.type,
    required: form.required,
    defaultValue: form.defaultValue || null,
    options: form.type === 'select' ? optionsText.value.split('\n').map(s => s.trim()).filter(Boolean) : null,
    isActive: form.isActive
  };

  saving.value = true;
  try {
    if (editingField.value) {
      await api.put(`/admin/custom-fields/${editingField.value.id}`, body);
      toast.success('Поле обновлено');
    } else {
      body.fieldKey = form.fieldKey;
      await api.post('/admin/custom-fields', body);
      toast.success('Поле создано');
    }
    showModal.value = false;
    await loadFields();
  } catch (err) {
    toast.error(err.message);
  }
  saving.value = false;
}

async function deleteField(field) {
  if (!confirm(`Удалить поле "${field.name}"?`)) return;
  try {
    await api.delete(`/admin/custom-fields/${field.id}`);
    toast.success('Поле удалено');
    await loadFields();
  } catch (err) {
    toast.error(err.message);
  }
}

async function loadFields() {
  loading.value = true;
  try {
    const res = await api.get('/admin/custom-fields');
    fields.value = res.data;
  } catch (err) {
    toast.error(err.message);
  }
  loading.value = false;
}

onMounted(loadFields);
</script>

<style scoped>
.dragging-card {
  opacity: 0.4;
}

.drag-over-card {
  border-top: 2px solid rgb(var(--v-theme-primary));
}

.drag-handle:active {
  cursor: grabbing;
}
</style>
