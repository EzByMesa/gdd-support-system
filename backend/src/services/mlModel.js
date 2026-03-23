/**
 * Сервис ML-embedding через @xenova/transformers.
 * Используем модель all-MiniLM-L6-v2 — компактная, быстрая, 384-мерные embeddings.
 * Работает полностью локально (скачивает модель при первом запуске ~80MB).
 */

let pipeline = null;
let loading = false;
let loadPromise = null;

/**
 * Загрузить pipeline для генерации embeddings
 */
async function getPipeline() {
  if (pipeline) return pipeline;
  if (loading) return loadPromise;

  loading = true;
  console.log('[ML] Загрузка модели all-MiniLM-L6-v2...');

  loadPromise = (async () => {
    try {
      const { pipeline: createPipeline } = await import('@xenova/transformers');
      pipeline = await createPipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('[ML] Модель загружена успешно');
      return pipeline;
    } catch (err) {
      console.error('[ML] Ошибка загрузки модели:', err.message);
      loading = false;
      loadPromise = null;
      throw err;
    }
  })();

  return loadPromise;
}

/**
 * Генерировать embedding для текста
 * @param {string} text
 * @returns {Promise<number[]>} — 384-мерный вектор
 */
export async function generateEmbedding(text) {
  const extractor = await getPipeline();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Cosine similarity между двумя векторами
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (normA * normB);
}

/**
 * Проверить, доступна ли модель
 */
export function isModelLoaded() {
  return pipeline !== null;
}
