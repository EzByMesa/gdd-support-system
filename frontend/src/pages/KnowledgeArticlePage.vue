<template>
  <MainLayout>
    <div v-if="loading" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" size="32" />
    </div>

    <template v-else-if="article">
      <div class="d-flex align-center mb-4">
        <v-btn icon="mdi-arrow-left" variant="text" size="small" @click="router.push('/knowledge')" class="mr-2" />
        <h1 class="text-h5 font-weight-bold" style="flex: 1">{{ article.title }}</h1>
      </div>

      <!-- Tags -->
      <div v-if="article.tags?.length" class="d-flex flex-wrap mb-3" style="gap: 6px">
        <v-chip v-for="tag in article.tags" :key="tag" size="small" label variant="tonal" color="primary">
          {{ tag }}
        </v-chip>
      </div>

      <!-- Meta -->
      <div class="d-flex align-center mb-4" style="gap: 12px; color: rgba(255,255,255,0.35)">
        <span class="text-caption">
          <v-icon size="12">mdi-account</v-icon> {{ article.author?.displayName }}
        </span>
        <span class="text-caption">
          <v-icon size="12">mdi-eye</v-icon> {{ article.viewCount }}
        </span>
        <span class="text-caption">
          {{ formatDate(article.createdAt) }}
        </span>
      </div>

      <!-- Content -->
      <v-card color="surface-light" class="mb-4">
        <v-card-text class="pa-4">
          <div class="knowledge-content" v-html="article.content" />
        </v-card-text>
      </v-card>

      <!-- Action -->
      <div class="d-flex justify-center">
        <v-btn color="primary" variant="outlined" prepend-icon="mdi-ticket-outline"
          @click="router.push('/tickets/new')">
          Не помогло? Создать обращение
        </v-btn>
      </div>
    </template>
  </MainLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/services/api.js';
import { toast } from '@/composables/useToast.js';
import MainLayout from '@/components/layout/MainLayout.vue';

const route = useRoute();
const router = useRouter();
const article = ref(null);
const loading = ref(true);

function formatDate(d) {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderMarkdown(text) {
  if (!text) return '';
  // Simple markdown renderer
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>').replace(/$/, '</p>');
}

onMounted(async () => {
  try {
    const res = await api.get(`/knowledge/${route.params.id}`);
    article.value = res.data;
  } catch (err) {
    toast.error(err.message);
    router.push('/knowledge');
  }
  loading.value = false;
});
</script>

<style>
.knowledge-content h2, .knowledge-content h3, .knowledge-content h4 {
  margin: 16px 0 8px;
  font-weight: 600;
}
.knowledge-content p { margin: 8px 0; line-height: 1.6; }
.knowledge-content code {
  background: rgba(255,255,255,0.08);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
}
</style>
