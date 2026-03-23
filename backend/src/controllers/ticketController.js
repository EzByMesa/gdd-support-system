import { Op } from 'sequelize';
import { getModels } from '../models/index.js';
import { TicketStatus, Role } from '../models/enums.js';
import { notify } from '../services/notification.js';
import { iLike } from '../utils/dbCompat.js';

/**
 * POST /api/tickets
 */
export async function createTicket(req, res) {
  const { title, description, priority } = req.body;

  if (!title || !description) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Укажите тему и описание обращения' }
    });
  }

  const { Ticket, User } = getModels();

  const ticket = await Ticket.create({
    title,
    description,
    priority: priority || 'MEDIUM',
    authorId: req.user.sub
  });

  const full = await Ticket.findByPk(ticket.id, {
    include: [
      { model: User, as: 'author', attributes: ['id', 'displayName'] },
      { model: getModels().Attachment }
    ]
  });

  res.status(201).json({ data: formatTicket(full, req.user) });

  // Фоновая классификация (не блокирует ответ)
  classifyInBackground(ticket.id, title, description);
}

/**
 * GET /api/tickets
 */
export async function listTickets(req, res) {
  const { page = 1, limit = 20, status, priority, search, assignee } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { Ticket, User } = getModels();

  const where = {};

  // Видимость по ролям
  if (req.user.role === Role.USER) {
    where.authorId = req.user.sub;
  }
  // AGENT и ADMIN видят все

  // Фильтры
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (assignee === 'me') where.assigneeId = req.user.sub;
  if (assignee === 'none') where.assigneeId = null;

  if (search) {
    where[Op.or] = [
      { title: iLike(`%${search}%`) },
      { description: iLike(`%${search}%`) }
    ];
  }

  const { TopicGroup, DelegationRequest } = getModels();

  const { count, rows } = await Ticket.findAndCountAll({
    where,
    include: [
      { model: User, as: 'author', attributes: ['id', 'displayName'] },
      { model: User, as: 'assignee', attributes: ['id', 'displayName'] },
      { model: TopicGroup, attributes: ['id', 'name'] },
      { model: DelegationRequest, where: { status: 'PENDING' }, required: false, attributes: ['id'] }
    ],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset
  });

  res.json({
    data: rows.map(t => formatTicket(t, req.user)),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      totalPages: Math.ceil(count / parseInt(limit))
    }
  });
}

/**
 * GET /api/tickets/:id
 */
export async function getTicket(req, res) {
  const { Ticket, User, Attachment, TicketMessage, AgentAlias } = getModels();

  const ticket = await Ticket.findByPk(req.params.id, {
    include: [
      { model: User, as: 'author', attributes: ['id', 'displayName'] },
      { model: User, as: 'assignee', attributes: ['id', 'displayName'] },
      { model: Attachment, attributes: ['id', 'originalName', 'mimeType', 'size', 'createdAt'] }
    ]
  });

  if (!ticket) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Тикет не найден' }
    });
  }

  // Проверка доступа: USER видит только свои
  if (req.user.role === Role.USER && ticket.authorId !== req.user.sub) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Нет доступа к этому обращению' }
    });
  }

  const result = formatTicket(ticket, req.user);

  // Для USER — подменяем имя агента на псевдоним
  if (req.user.role === Role.USER && ticket.assigneeId) {
    const alias = await AgentAlias.findOne({
      where: { agentId: ticket.assigneeId, ticketId: ticket.id }
    });
    if (alias) {
      result.assignee = { displayName: alias.alias };
    }
  }

  res.json({ data: result });
}

/**
 * PUT /api/tickets/:id
 */
export async function updateTicket(req, res) {
  const { Ticket } = getModels();
  const ticket = await Ticket.findByPk(req.params.id);

  if (!ticket) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Тикет не найден' }
    });
  }

  // Только автор или админ
  if (req.user.role !== Role.ADMIN && ticket.authorId !== req.user.sub) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Нет прав на редактирование' }
    });
  }

  const { title, description } = req.body;
  if (title) ticket.title = title;
  if (description) ticket.description = description;

  await ticket.save();
  res.json({ data: formatTicket(ticket, req.user) });
}

/**
 * PUT /api/tickets/:id/status
 */
export async function updateStatus(req, res) {
  const { status } = req.body;
  const { Ticket } = getModels();

  if (!status || !Object.values(TicketStatus).includes(status)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Невалидный статус' }
    });
  }

  const ticket = await Ticket.findByPk(req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Тикет не найден' } });
  }

  // Проверка прав: assignee, автор-агент, или admin
  if (req.user.role === Role.USER) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Нет прав' }
    });
  }
  if (req.user.role === Role.AGENT) {
    const isAssignee = ticket.assigneeId === req.user.sub;
    const isAuthor = ticket.authorId === req.user.sub;
    if (!isAssignee && !isAuthor) {
      return res.status(403).json({
        error: { code: 'TICKET_READONLY', message: 'Тикет назначен на другого агента' }
      });
    }
  }

  ticket.status = status;
  if (status === TicketStatus.CLOSED || status === TicketStatus.RESOLVED) {
    ticket.closedAt = new Date();
  }

  await ticket.save();
  res.json({ data: formatTicket(ticket, req.user) });

  // Уведомление автору тикета
  const statusLabels = { IN_PROGRESS: 'В работе', WAITING_FOR_USER: 'Ожидает ответа', RESOLVED: 'Решён', CLOSED: 'Закрыт' };
  notify(ticket.authorId, {
    type: 'STATUS_CHANGED',
    title: `Обращение #${ticket.number}`,
    body: `Статус изменён: ${statusLabels[status] || status}`,
    data: { ticketId: ticket.id }
  }).catch(() => {});
}

/**
 * PUT /api/tickets/:id/assign
 * Агент берёт тикет в работу
 */
export async function assignTicket(req, res) {
  const { Ticket, AgentAlias } = getModels();

  const ticket = await Ticket.findByPk(req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Тикет не найден' } });
  }

  // Можно взять только OPEN тикет
  if (ticket.status !== TicketStatus.OPEN) {
    return res.status(400).json({
      error: { code: 'INVALID_STATUS', message: 'Можно взять только открытый тикет' }
    });
  }

  ticket.assigneeId = req.user.sub;
  ticket.status = TicketStatus.IN_PROGRESS;
  await ticket.save();

  // Генерируем анонимный псевдоним
  const { getOrCreateAlias } = await import('../services/agentAlias.js');
  const alias = await getOrCreateAlias(req.user.sub, ticket.id);

  res.json({
    data: {
      ...formatTicket(ticket, req.user),
      agentAlias: alias
    }
  });

  // Уведомление автору тикета
  notify(ticket.authorId, {
    type: 'TICKET_ASSIGNED',
    title: `Обращение #${ticket.number}`,
    body: `Вашим обращением занимается ${alias}`,
    data: { ticketId: ticket.id }
  }).catch(() => {});
}

/**
 * PUT /api/tickets/:id/priority
 */
export async function updatePriority(req, res) {
  const { priority } = req.body;
  const { Ticket } = getModels();

  const ticket = await Ticket.findByPk(req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Тикет не найден' } });
  }

  if (req.user.role === Role.AGENT && ticket.assigneeId !== req.user.sub) {
    return res.status(403).json({
      error: { code: 'TICKET_READONLY', message: 'Тикет назначен на другого агента' }
    });
  }
  if (req.user.role === Role.USER) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Нет прав' } });
  }

  ticket.priority = priority;
  await ticket.save();
  res.json({ data: formatTicket(ticket, req.user) });
}

/**
 * Форматирование тикета для ответа.
 * Добавляет readonly флаг для агентов.
 */
/**
 * Фоновая классификация тикета (не блокирует HTTP ответ)
 */
async function classifyInBackground(ticketId, title, description) {
  try {
    const { classifyTicket } = await import('../services/topicGrouping.js');
    const result = await classifyTicket(title, description);
    const { Ticket } = getModels();
    await Ticket.update({ topicGroupId: result.groupId }, { where: { id: ticketId } });
    console.log(`[ML] Тикет ${ticketId} → группа "${result.groupName}" (${result.isNew ? 'новая' : `score: ${result.score.toFixed(3)}`})`);
  } catch (err) {
    console.error(`[ML] Ошибка классификации тикета ${ticketId}:`, err.message);
  }
}

function formatTicket(ticket, requestUser) {
  const plain = ticket.toJSON ? ticket.toJSON() : { ...ticket };

  let readonly = false;
  if (requestUser.role === Role.AGENT) {
    readonly = !!(plain.assigneeId && plain.assigneeId !== requestUser.sub);
  }

  return {
    id: plain.id,
    number: plain.number,
    title: plain.title,
    description: plain.description,
    status: plain.status,
    priority: plain.priority,
    author: plain.author || null,
    assignee: plain.assignee || null,
    topicGroupId: plain.topicGroupId,
    topicGroup: plain.TopicGroup ? { id: plain.TopicGroup.id, name: plain.TopicGroup.name } : null,
    hasPendingDelegation: !!(plain.DelegationRequests && plain.DelegationRequests.length > 0),
    attachments: plain.Attachments || [],
    readonly,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    closedAt: plain.closedAt
  };
}
