/**
 * Сервис суммаризации тикетов для базы знаний.
 * Использует text2text-generation модель Xenova/LaMini-Flan-T5-248M (~500MB).
 * Модель скачивается при первом запуске, НЕ хранится в репозитории.
 */

let summarizer = null;
let loading = false;
let loadPromise = null;

const MODEL_NAME = 'Xenova/LaMini-Flan-T5-248M';

async function getSummarizer() {
  if (summarizer) return summarizer;
  if (loading) return loadPromise;

  loading = true;
  console.log(`[ML] Загрузка модели суммаризации ${MODEL_NAME}...`);
  console.log('[ML] Первый запуск — скачивание ~500MB, это может занять несколько минут...');

  loadPromise = (async () => {
    try {
      const { pipeline: createPipeline } = await import('@xenova/transformers');
      summarizer = await createPipeline('text2text-generation', MODEL_NAME);
      console.log('[ML] Модель суммаризации загружена');
      return summarizer;
    } catch (err) {
      console.error('[ML] Ошибка загрузки модели суммаризации:', err.message);
      loading = false;
      loadPromise = null;
      throw err;
    }
  })();

  return loadPromise;
}

/**
 * Сформировать структурированную статью из тикета.
 * Если модель доступна — использует ML для суммаризации.
 * Если нет — формирует вручную по шаблону.
 *
 * @param {object} params - { title, description, messages: [{ content, authorRole }] }
 * @returns {Promise<string>} — HTML-контент статьи
 */
export async function generateArticleContent({ title, description, messages }) {
  // Разделяем сообщения по ролям
  const userMessages = messages.filter(m => m.authorRole === 'USER').map(m => m.content);
  const staffMessages = messages.filter(m => m.authorRole !== 'USER').map(m => m.content);

  // Пробуем ML-суммаризацию
  try {
    const model = await getSummarizer();

    // Формируем промпт для суммаризации
    const problemText = [description, ...userMessages].join('. ').substring(0, 500);
    const solutionText = staffMessages.join('. ').substring(0, 500);

    const problemPrompt = `Summarize the following problem description in 2-3 clear sentences in Russian: ${problemText}`;
    const problemResult = await model(problemPrompt, { max_new_tokens: 150 });
    const problemSummary = problemResult[0]?.generated_text || description;

    let solutionSummary = '';
    if (solutionText.trim()) {
      const solutionPrompt = `Summarize the following solution steps in 2-3 clear bullet points in Russian: ${solutionText}`;
      const solutionResult = await model(solutionPrompt, { max_new_tokens: 200 });
      solutionSummary = solutionResult[0]?.generated_text || solutionText;
    }

    console.log(`[ML] Статья сгенерирована для: "${title}"`);

    return buildArticleHtml(title, problemSummary, solutionSummary, staffMessages);
  } catch (err) {
    console.warn(`[ML] Суммаризация недоступна (${err.message}), используем шаблон`);
    return buildArticleFromTemplate(title, description, userMessages, staffMessages);
  }
}

/**
 * Собрать HTML-статью из ML-суммаризации
 */
function buildArticleHtml(title, problemSummary, solutionSummary, staffMessages) {
  let html = `<h2>Проблема</h2><p>${escapeHtml(problemSummary)}</p>`;

  if (solutionSummary) {
    html += `<h2>Решение</h2><p>${escapeHtml(solutionSummary)}</p>`;
  }

  // Добавляем ключевые шаги из ответов поддержки
  if (staffMessages.length > 0) {
    html += `<h2>Подробности</h2><ul>`;
    // Берём только содержательные ответы (> 20 символов, макс 5)
    const meaningful = staffMessages.filter(m => m.length > 20).slice(0, 5);
    for (const msg of meaningful) {
      html += `<li>${escapeHtml(msg.substring(0, 200))}${msg.length > 200 ? '...' : ''}</li>`;
    }
    html += `</ul>`;
  }

  return html;
}

/**
 * Fallback: собрать статью по шаблону без ML
 */
function buildArticleFromTemplate(title, description, userMessages, staffMessages) {
  let html = `<h2>Проблема</h2><p>${escapeHtml(description)}</p>`;

  if (staffMessages.length > 0) {
    html += `<h2>Решение</h2>`;
    // Берём только ответы поддержки как шаги решения
    const steps = staffMessages.filter(m => m.length > 10).slice(0, 7);
    if (steps.length === 1) {
      html += `<p>${escapeHtml(steps[0])}</p>`;
    } else if (steps.length > 1) {
      html += `<ol>`;
      for (const step of steps) {
        html += `<li>${escapeHtml(step.substring(0, 300))}${step.length > 300 ? '...' : ''}</li>`;
      }
      html += `</ol>`;
    }
  }

  return html;
}

function escapeHtml(text) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Проверить, загружена ли модель суммаризации
 */
export function isSummarizerLoaded() {
  return summarizer !== null;
}
