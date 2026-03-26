<template>
  <MainLayout>
    <div class="d-flex align-center justify-space-between mb-4">
      <span class="text-h5 font-weight-bold">База знаний</span>
    </div>

    <!-- Search -->
    <v-text-field
      v-model="search"
      placeholder="Поиск по базе знаний..."
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
      density="compact"
      hide-details
      clearable
      class="mb-4"
      @update:model-value="debouncedLoad"
    />

    <div v-if="loading" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" size="32" />
    </div>

    <div v-else-if="articles.length === 0" class="text-center py-8">
      <v-icon size="48" style="opacity: 0.2" class="mb-2">mdi-book-open-variant</v-icon>
      <div class="text-body-2" style="color: rgba(255,255,255,0.3)">
        {{ search ? 'Ничего не найдено' : 'База знаний пока пуста' }}
      </div>
    </div>

    <v-row v-else>
      <v-col v-for="a in articles" :key="a.id" cols="12" md="6">
        <v-card color="surface-light" class="ticket-card-hover" style="cursor: pointer"
          @click="router.push(`/knowledge/${a.id}`)">
          <v-card-text>
            <div class="text-body-1 font-weight-bold mb-1">{{ a.title }}</div>
            <div class="text-body-2 mb-2" style="color: rgba(255,255,255,0.5); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden">
              {{ stripMarkdown(a.content) }}
            </div>
            <div class="d-flex align-center" style="gap: 6px">
              <v-chip v-for="tag in (a.tags || []).slice(0, 3)" :key="tag" size="x-small" label variant="tonal">
                {{ tag }}
              </v-chip>
              <v-spacer />
              <span class="text-caption" style="color: rgba(255,255,255,0.25)">
                <v-icon size="12">mdi-eye</v-icon> {{ a.viewCount }}
              </span>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <div v-if="pagination && pagination.totalPages > 1" class="d-flex justify-center mt-4">
      <v-pagination v-model="page" :length="pagination.totalPages" :total-visible="5"
        density="compact" size="small" @update:model-value="load" />
    </div>
  </MainLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/services/api.js';
import { toast } from '@/composables/useToast.js';
import MainLayout from '@/components/layout/MainLayout.vue';

const router = useRouter();
const articles = ref([]);
const pagination = ref(null);
const page = ref(1);
const search = ref('');
const loading = ref(false);

let searchTimer = null;
function debouncedLoad() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { page.value = 1; load(); }, 300);
}

function stripMarkdown(text) {
  return (text || '').replace(/[#*_~`>\[\]()!-]/g, '').replace(/\n+/g, ' ').trim();
}

async function load() {
  loading.value = true;
  try {
    const query = { page: page.value, limit: 12 };
    if (search.value) query.search = search.value;
    const res = await api.get('/knowledge', query);
    articles.value = res.data;
    pagination.value = res.pagination;
  } catch (err) { toast.error(err.message); }
  loading.value = false;
}

onMounted(load);
</script>
