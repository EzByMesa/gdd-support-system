import { Op } from 'sequelize';
import { getModels } from '../models/index.js';
import { generateEmbedding, cosineSimilarity } from '../services/mlModel.js';
import { generateArticleContent } from '../services/summarizer.js';
import { iLike } from '../utils/dbCompat.js';

/**
 * GET /api/knowledge
 */
export async function listArticles(req, res) {
  const { page = 1, limit = 20, search, category, includeDrafts } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { KnowledgeArticle, User } = getModels();

  const isStaff = ['AGENT', 'SENIOR_AGENT', 'ADMIN'].includes(req.user.role);
  const where = {};
  if (!isStaff || !includeDrafts) where.isPublished = true;
  if (category) where.category = category;
  if (search) {
    where[Op.or] = [
      { title: iLike(`%${search}%`) },
      { content: iLike(`%${search}%`) }
    ];
  }

  const { count, rows } = await KnowledgeArticle.findAndCountAll({
    where,
    include: [{ model: User, as: 'author', attributes: ['id', 'displayName'] }],
    attributes: { exclude: ['embedding'] },
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset
  });

  res.json({
    data: rows,
    pagination: { page: parseInt(page), limit: parseInt(limit), total: count, totalPages: Math.ceil(count / parseInt(limit)) }
  });
}

/**
 * GET /api/knowledge/:id
 */
export async function getArticle(req, res) {
  const { KnowledgeArticle, User } = getModels();
  const article = await KnowledgeArticle.findByPk(req.params.id, {
    include: [{ model: User, as: 'author', attributes: ['id', 'displayName'] }],
    attributes: { exclude: ['embedding'] }
  });

  if (!article) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Статья не найдена' } });
  }

  // Инкремент просмотров
  article.viewCount += 1;
  await article.save({ silent: true });

  res.json({ data: article });
}

/**
 * POST /api/knowledge
 */
export async function createArticle(req, res) {
  const { title, content, tags, category, isPublished } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Укажите заголовок и содержание' } });
  }

  const { KnowledgeArticle } = getModels();

  // Генерируем embedding
  let embedding = null;
  try {
    embedding = await generateEmbedding(`${title} ${content}`);
  } catch (err) {
    console.error('[Knowledge] Ошибка генерации embedding:', err.message);
  }

  const article = await KnowledgeArticle.create({
    title, content,
    tags: tags || [],
    category: category || null,
    embedding,
    isPublished: isPublished !== false,
    authorId: req.user.sub
  });

  res.status(201).json({ data: article });
}

/**
 * PUT /api/knowledge/:id
 */
export async function updateArticle(req, res) {
  const { KnowledgeArticle } = getModels();
  const article = await KnowledgeArticle.findByPk(req.params.id);
  if (!article) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Статья не найдена' } });

  const { title, content, tags, category, isPublished } = req.body;
  if (title) article.title = title;
  if (content) article.content = content;
  if (tags !== undefined) article.tags = tags;
  if (category !== undefined) article.category = category;
  if (isPublished !== undefined) article.isPublished = isPublished;

  // Пересчитываем embedding если контент изменился
  if (title || content) {
    try {
      article.embedding = await generateEmbedding(`${article.title} ${article.content}`);
    } catch { /* keep old */ }
  }

  await article.save();
  res.json({ data: article });
}

/**
 * DELETE /api/knowledge/:id
 */
export async function deleteArticle(req, res) {
  const { KnowledgeArticle } = getModels();
  const article = await KnowledgeArticle.findByPk(req.params.id);
  if (!article) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Статья не найдена' } });

  await article.destroy();
  res.status(204).send();
}

/**
 * POST /api/knowledge/search
 * Гибридный поиск: ключевые слова + ML embedding
 */
export async function searchSimilar(req, res) {
  const { query } = req.body;
  if (!query || query.trim().length < 3) {
    return res.json({ data: [] });
  }

  const { KnowledgeArticle, User } = getModels();

  // Загружаем все опубликованные статьи с embedding
  const articles = await KnowledgeArticle.findAll({
    where: { isPublished: true },
    include: [{ model: User, as: 'author', attributes: ['id', 'displayName'] }]
  });

  if (articles.length === 0) return res.json({ data: [] });

  // 1. Текстовый поиск (простой scoring)
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter(w => w.length > 2);

  // 2. ML поиск
  let queryEmbedding = null;
  try {
    queryEmbedding = await generateEmbedding(query);
  } catch { /* ML недоступен */ }

  const scored = articles.map(article => {
    // Текстовый score
    const textLower = `${article.title} ${article.content}`.toLowerCase();
    let textScore = 0;
    for (const kw of keywords) {
      if (textLower.includes(kw)) textScore += 1;
    }
    textScore = keywords.length > 0 ? textScore / keywords.length : 0;

    // ML score
    let mlScore = 0;
    if (queryEmbedding && article.embedding) {
      mlScore = cosineSimilarity(queryEmbedding, article.embedding);
    }

    // Гибридный score
    const score = queryEmbedding
      ? 0.4 * textScore + 0.6 * mlScore
      : textScore;

    return { article, score, textScore, mlScore };
  });

  // Фильтруем и сортируем
  const results = scored
    .filter(r => r.score > 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(r => ({
      id: r.article.id,
      title: r.article.title,
      content: r.article.content.substring(0, 200) + (r.article.content.length > 200 ? '...' : ''),
      tags: r.article.tags,
      category: r.article.category,
      score: Math.round(r.score * 100),
      author: r.article.author
    }));

  res.json({ data: results });
}

/**
 * POST /api/knowledge/from-ticket/:ticketId
 * Конвертировать закрытый тикет в статью базы знаний
 */
export async function convertFromTicket(req, res) {
  const { Ticket, TicketMessage, User } = getModels();
  const { KnowledgeArticle } = getModels();

  const ticket = await Ticket.findByPk(req.params.ticketId, {
    include: [{ model: User, as: 'author', attributes: ['id', 'displayName'] }]
  });

  if (!ticket) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Тикет не найден' } });
  }

  // Загружаем все сообщения (не системные)
  const messages = await TicketMessage.findAll({
    where: { ticketId: ticket.id, isSystem: false },
    include: [{ model: User, as: 'author', attributes: ['id', 'displayName', 'role'] }],
    order: [['createdAt', 'ASC']]
  });

  // Генерируем структурированный контент через ML-суммаризацию
  console.log(`[Knowledge] Генерация статьи из тикета #${ticket.number}: "${ticket.title}"`);
  const content = await generateArticleContent({
    title: ticket.title,
    description: ticket.description,
    messages: messages.map(m => ({
      content: m.content,
      authorRole: m.author?.role || 'USER'
    }))
  });

  // Генерируем embedding
  const fullText = `${ticket.title} ${ticket.description} ${messages.map(m => m.content).join(' ')}`;
  let embedding = null;
  try {
    embedding = await generateEmbedding(fullText);
  } catch { /* */ }

  // Создаём черновик
  const article = await KnowledgeArticle.create({
    title: ticket.title,
    content,
    tags: [],
    embedding,
    sourceTicketId: ticket.id,
    authorId: req.user.sub,
    isPublished: false // черновик — агент редактирует перед публикацией
  });

  res.status(201).json({ data: article });
}
