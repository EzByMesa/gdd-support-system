import { Op } from 'sequelize';
import { getModels } from '../models/index.js';
import { TicketStatus, Role } from '../models/enums.js';
import { notify } from '../services/notification.js';
import { broadcastToRoom } from '../websocket/wsServer.js';
import { iLike } from '../utils/dbCompat.js';

/**
 * POST /api/tickets
 */
export async function createTicket(req, res) {
  const { title, description, priority, customFields } = req.body;

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
    authorId: req.user.sub,
    customFields: customFields || null
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

  const { TopicGroup, DelegationRequest, AgentAlias } = getModels();

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

  const formatted = rows.map(t => formatTicket(t, req.user));

  // Для USER — подменяем имена агентов на псевдонимы в списке
  if (req.user.role === Role.USER) {
    const ticketIds = rows.filter(t => t.assigneeId).map(t => t.id);
    if (ticketIds.length > 0) {
      const aliases = await AgentAlias.findAll({ where: { ticketId: ticketIds } });
      const aliasMap = new Map();
      for (const a of aliases) {
        aliasMap.set(`${a.agentId}:${a.ticketId}`, a.alias);
      }
      for (let i = 0; i < rows.length; i++) {
        const t = rows[i];
        if (t.assigneeId) {
          const alias = aliasMap.get(`${t.assigneeId}:${t.id}`);
          if (alias) {
            formatted[i].assignee = { displayName: alias };
          }
        }
      }
    }
  }

  res.json({
    data: formatted,
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

  // Перезагружаем с ассоциациями
  const { User, Attachment } = getModels();
  const full = await Ticket.findByPk(ticket.id, {
    include: [
      { model: User, as: 'author', attributes: ['id', 'displayName'] },
      { model: User, as: 'assignee', attributes: ['id', 'displayName'] },
      { model: Attachment, attributes: ['id', 'originalName', 'mimeType', 'size', 'createdAt'] }
    ]
  });
  res.json({ data: formatTicket(full, req.user) });

  // Оповещаем участников чата о смене статуса через WS
  broadcastToRoom(ticket.id, {
    type: 'status_changed',
    data: { status, ticketId: ticket.id }
  });

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

  // Агент не может взять свой собственный тикет
  if (ticket.authorId === req.user.sub) {
    return res.status(400).json({
      error: { code: 'SELF_ASSIGN', message: 'Нельзя взять в работу собственное обращение' }
    });
  }

  ticket.assigneeId = req.user.sub;
  ticket.status = TicketStatus.IN_PROGRESS;
  await ticket.save();

  // Генерируем анонимный псевдоним
  const { getOrCreateAlias } = await import('../services/agentAlias.js');
  const alias = await getOrCreateAlias(req.user.sub, ticket.id);

  // Перезагружаем тикет с ассоциациями для корректного ответа
  const { User, Attachment } = getModels();
  const full = await Ticket.findByPk(ticket.id, {
    include: [
      { model: User, as: 'author', attributes: ['id', 'displayName'] },
      { model: User, as: 'assignee', attributes: ['id', 'displayName'] },
      { model: Attachment, attributes: ['id', 'originalName', 'mimeType', 'size', 'createdAt'] }
    ]
  });

  res.json({
    data: {
      ...formatTicket(full, req.user),
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
 * PUT /api/tickets/:id/close
 * Пользователь закрывает собственное обращение с указанием причины.
 */
export async function closeTicket(req, res) {
  const { reason } = req.body;
  const { Ticket, User, Attachment } = getModels();

  if (!reason || !reason.trim()) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Укажите причину закрытия' }
    });
  }

  const ticket = await Ticket.findByPk(req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Тикет не найден' } });
  }

  // Только автор может закрыть своё обращение
  if (ticket.authorId !== req.user.sub) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Вы можете закрыть только своё обращение' }
    });
  }

  // Нельзя закрыть уже закрытый тикет
  if (ticket.status === TicketStatus.CLOSED) {
    return res.status(400).json({
      error: { code: 'INVALID_STATUS', message: 'Обращение уже закрыто' }
    });
  }

  ticket.status = TicketStatus.CLOSED;
  ticket.closedAt = new Date();
  ticket.closedReason = reason.trim();
  await ticket.save();

  const full = await Ticket.findByPk(ticket.id, {
    include: [
      { model: User, as: 'author', attributes: ['id', 'displayName'] },
      { model: User, as: 'assignee', attributes: ['id', 'displayName'] },
      { model: Attachment, attributes: ['id', 'originalName', 'mimeType', 'size', 'createdAt'] }
    ]
  });

  res.json({ data: formatTicket(full, req.user) });

  // Оповещаем участников чата о закрытии через WS
  broadcastToRoom(ticket.id, {
    type: 'status_changed',
    data: { status: 'CLOSED', ticketId: ticket.id }
  });

  // Уведомляем назначенного агента
  if (ticket.assigneeId) {
    notify(ticket.assigneeId, {
      type: 'STATUS_CHANGED',
      title: `Обращение #${ticket.number}`,
      body: `Пользователь закрыл обращение: ${reason.trim()}`,
      data: { ticketId: ticket.id }
    }).catch(() => {});
  }
}

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
  if (plain.status === 'CLOSED' || plain.status === 'RESOLVED') {
    readonly = true;
  } else if (requestUser.role === Role.AGENT) {
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
    customFields: plain.customFields || null,
    readonly,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    closedAt: plain.closedAt,
    closedReason: plain.closedReason || null
  };
}
