<template>
  <AdminLayout>
    <v-container fluid>
      <div class="d-flex align-center justify-space-between mb-6">
        <div class="text-h5 font-weight-bold">База знаний</div>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="openEditor(null)">
          Новая статья
        </v-btn>
      </div>

      <!-- Tabs: published / drafts -->
      <v-btn-toggle v-model="tab" mandatory color="primary" density="compact" class="mb-4">
        <v-btn value="all">Все ({{ articles.length }})</v-btn>
        <v-btn value="drafts">
          Черновики ({{ articles.filter(a => !a.isPublished).length }})
        </v-btn>
      </v-btn-toggle>

      <v-row v-if="loading" justify="center"><v-progress-circular indeterminate /></v-row>

      <v-alert v-else-if="filteredArticles.length === 0" type="info" variant="tonal">
        {{ tab === 'drafts' ? 'Нет черновиков' : 'Нет статей' }}
      </v-alert>

      <v-card v-else variant="outlined">
        <v-list lines="two">
          <v-list-item v-for="a in filteredArticles" :key="a.id" @click="openEditor(a)">
            <template #prepend>
              <v-icon :color="a.isPublished ? 'success' : 'warning'" size="18">
                {{ a.isPublished ? 'mdi-check-circle' : 'mdi-pencil-circle' }}
              </v-icon>
            </template>
            <v-list-item-title>{{ a.title }}</v-list-item-title>
            <v-list-item-subtitle>
              {{ a.isPublished ? 'Опубликована' : 'Черновик' }} &middot;
              <v-icon size="12">mdi-eye</v-icon> {{ a.viewCount }} &middot;
              {{ a.author?.displayName }}
            </v-list-item-subtitle>
            <template #append>
              <v-btn icon="mdi-delete-outline" color="error" variant="text" size="small"
                @click.stop="deleteArticle(a)" />
            </template>
          </v-list-item>
        </v-list>
      </v-card>

      <!-- Full-screen Editor Dialog -->
      <v-dialog v-model="showEditor" max-width="900" persistent scrollable>
        <v-card>
          <v-card-title class="d-flex align-center justify-space-between">
            <span>{{ editingId ? 'Редактировать статью' : 'Новая статья' }}</span>
            <v-btn icon variant="text" size="small" @click="showEditor = false">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </v-card-title>
          <v-divider />
          <v-card-text style="max-height: 75vh; overflow-y: auto">
            <v-text-field v-model="form.title" label="Заголовок" variant="outlined"
              density="compact" class="mb-3" :rules="[v => !!v || 'Обязательно']" />

            <!-- Rich Editor -->
            <div class="text-caption font-weight-bold mb-1" style="color: rgba(255,255,255,0.4)">Содержание</div>
            <RichEditor v-model="form.content" class="mb-3" />

            <v-row>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.tagsStr" label="Теги (через запятую)"
                  variant="outlined" density="compact" placeholder="vpn, почта, настройка" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.category" label="Категория"
                  variant="outlined" density="compact" />
              </v-col>
            </v-row>

            <v-switch v-model="form.isPublished" label="Опубликовать" color="success" hide-details />
          </v-card-text>
          <v-divider />
          <v-card-actions class="px-4 py-3">
            <v-spacer />
            <v-btn variant="text" @click="showEditor = false">Отмена</v-btn>
            <v-btn color="primary" :loading="saving" @click="save">
              {{ form.isPublished ? 'Опубликовать' : 'Сохранить черновик' }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </AdminLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/services/api.js';
import { toast } from '@/composables/useToast.js';
import AdminLayout from '@/components/layout/AdminLayout.vue';
import RichEditor from '@/components/ui/RichEditor.vue';

const route = useRoute();
const articles = ref([]);
const loading = ref(true);
const showEditor = ref(false);
const saving = ref(false);
const editingId = ref(null);
const tab = ref('all');

const form = reactive({
  title: '', content: '', tagsStr: '', category: '', isPublished: true
});

const filteredArticles = computed(() => {
  if (tab.value === 'drafts') return articles.value.filter(a => !a.isPublished);
  return articles.value;
});

function openEditor(article) {
  if (article) {
    editingId.value = article.id;
    form.title = article.title;
    form.content = article.content;
    form.tagsStr = (article.tags || []).join(', ');
    form.category = article.category || '';
    form.isPublished = article.isPublished;
  } else {
    editingId.value = null;
    form.title = '';
    form.content = '';
    form.tagsStr = '';
    form.category = '';
    form.isPublished = true;
  }
  showEditor.value = true;
}

async function save() {
  if (!form.title || !form.content) { toast.warning('Заполните заголовок и содержание'); return; }
  saving.value = true;
  const body = {
    title: form.title,
    content: form.content,
    tags: form.tagsStr.split(',').map(t => t.trim()).filter(Boolean),
    category: form.category || null,
    isPublished: form.isPublished
  };
  try {
    if (editingId.value) {
      await api.put(`/knowledge/${editingId.value}`, body);
      toast.success('Статья обновлена');
    } else {
      await api.post('/knowledge', body);
      toast.success('Статья создана');
    }
    showEditor.value = false;
    await load();
  } catch (err) { toast.error(err.message); }
  saving.value = false;
}

async function deleteArticle(a) {
  if (!confirm(`Удалить "${a.title}"?`)) return;
  try {
    await api.delete(`/knowledge/${a.id}`);
    toast.success('Удалена');
    await load();
  } catch (err) { toast.error(err.message); }
}

async function load() {
  loading.value = true;
  try {
    // Загружаем все (включая черновики) для админки
    const res = await api.get('/knowledge', { limit: 200, includeDrafts: true });
    articles.value = res.data;
  } catch (err) { toast.error(err.message); }
  loading.value = false;
}

onMounted(async () => {
  await load();

  // Если есть query ?edit=ID — открыть редактор для черновика
  const editId = route.query.edit;
  if (editId) {
    const article = articles.value.find(a => a.id === editId);
    if (article) {
      openEditor(article);
    } else {
      // Загрузить отдельно (может быть черновик)
      try {
        const res = await api.get(`/knowledge/${editId}`);
        if (res.data) openEditor(res.data);
      } catch { /* */ }
    }
  }
});
</script>
