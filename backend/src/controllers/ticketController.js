import { Op, literal } from 'sequelize';
import { getModels, getSequelize } from '../models/index.js';
import { TicketStatus, Role } from '../models/enums.js';
import { notify } from '../services/notification.js';
import { broadcastToRoom, sendToUser } from '../websocket/wsServer.js';
import { iLike } from '../utils/dbCompat.js';

/** Роли с правами поддержки */
const STAFF_ROLES = [Role.AGENT, Role.SENIOR_AGENT, Role.ADMIN];
function isStaffRole(role) { return STAFF_ROLES.includes(role); }

/**
 * Создать системное сообщение в чате тикета и разослать через WS.
 */
async function createSystemMessage(ticketId, content) {
  const { TicketMessage } = getModels();
  const msg = await TicketMessage.create({ ticketId, content, isSystem: true, authorId: null });

  const payload = {
    type: 'message',
    data: {
      id: msg.id,
      content: msg.content,
      isSystem: true,
      createdAt: msg.createdAt,
      author: { id: null, displayName: 'Система' },
      attachments: []
    }
  };
  broadcastToRoom(ticketId, payload);
  return msg;
}

/**
 * Upsert lastReadAt для пользователя в тикете.
 */
export async function upsertReadStatus(userId, ticketId) {
  const { TicketReadStatus } = getModels();
  const [record] = await TicketReadStatus.findOrCreate({
    where: { userId, ticketId },
    defaults: { lastReadAt: new Date() }
  });
  if (record) {
    record.lastReadAt = new Date();
    await record.save();
  }
}

/**
 * PUT /api/tickets/:id/read
 */
export async function markTicketRead(req, res) {
  await upsertReadStatus(req.user.sub, req.params.id);
  res.json({ data: { success: true } });
}

/**
 * POST /api/tickets
 */
export async function createTicket(req, res) {
  const { title, description, priority, customFields, onBehalfOfUserId } = req.body;

  if (!title || !description) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Укажите тему и описание обращения' }
    });
  }

  const { Ticket, User } = getModels();
  const isStaff = isStaffRole(req.user.role);

  // Агенты/админы создают тикеты ТОЛЬКО от имени других пользователей
  let authorId = req.user.sub;
  let createdById = null;

  if (isStaff) {
    if (!onBehalfOfUserId) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Выберите пользователя, от имени которого создаётся обращение' }
      });
    }
    const targetUser = await User.findByPk(onBehalfOfUserId);
    if (!targetUser) {
      return res.status(400).json({
        error: { code: 'NOT_FOUND', message: 'Пользователь не найден' }
      });
    }
    authorId = onBehalfOfUserId;
    createdById = req.user.sub;
  }

  const ticket = await Ticket.create({
    title,
    description,
    priority: priority || 'MEDIUM',
    authorId,
    createdById,
    customFields: customFields || null
  });

  const full = await Ticket.findByPk(ticket.id, {
    include: [
      { model: User, as: 'author', attributes: ['id', 'displayName', 'avatarPath'] },
      { model: getModels().Attachment }
    ]
  });

  res.status(201).json({ data: formatTicket(full, req.user) });

  // Уведомить всех агентов и админов о новом обращении
  const agents = await User.findAll({
    where: { role: STAFF_ROLES, isActive: true },
    attributes: ['id']
  });
  for (const agent of agents) {
    if (agent.id === req.user.sub) continue;
    // WS-событие для автообновления списка тикетов
    sendToUser(agent.id, { type: 'tickets_updated' });
    // Уведомление
    notify(agent.id, {
      type: 'NEW_TICKET',
      title: `Новое обращение #${ticket.number}`,
      body: title,
      data: { ticketId: ticket.id }
    }).catch(() => {});
  }

  // Фоновая классификация (не блокирует ответ)
  classifyInBackground(ticket.id, title, description);
}

/**
 * GET /api/tickets
 */
export async function listTickets(req, res) {
  const { page = 1, limit = 20, status, priority, search, assignee, sort = 'createdAt', sortDir = 'DESC' } = req.query;
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
      { model: User, as: 'author', attributes: ['id', 'displayName', 'avatarPath'] },
      { model: User, as: 'assignee', attributes: ['id', 'displayName'] },
      { model: User, as: 'createdBy', attributes: ['id', 'displayName'] },
      { model: TopicGroup, attributes: ['id', 'name'] },
      { model: DelegationRequest, where: { status: 'PENDING' }, required: false, attributes: ['id'] }
    ],
    order: [[['createdAt', 'updatedAt', 'priority', 'status', 'number'].includes(sort) ? sort : 'createdAt', ['ASC', 'DESC'].includes(sortDir?.toUpperCase()) ? sortDir.toUpperCase() : 'DESC']],
    limit: parseInt(limit),
    offset
  });

  const formatted = rows.map(t => formatTicket(t, req.user));

  // Считаем непрочитанные сообщения batch-запросом (1 запрос вместо N)
  const ticketIds = rows.map(t => t.id);
  if (ticketIds.length > 0) {
    const sequelize = getSequelize();
    const idList = ticketIds.map(id => `'${id}'`).join(',');
    const [unreadRows] = await sequelize.query(`
      SELECT tm."ticketId", COUNT(*) as cnt
      FROM ticket_messages tm
      LEFT JOIN ticket_read_statuses trs
        ON trs."ticketId" = tm."ticketId" AND trs."userId" = '${req.user.sub}'
      WHERE tm."ticketId" IN (${idList})
        AND tm."authorId" != '${req.user.sub}'
        AND (tm."isSystem" = false OR tm."isSystem" IS NULL)
        AND (trs."lastReadAt" IS NULL OR tm."createdAt" > trs."lastReadAt")
      GROUP BY tm."ticketId"
    `);
    const unreadMap = new Map();
    for (const r of unreadRows) unreadMap.set(r.ticketId, parseInt(r.cnt));
    for (let i = 0; i < formatted.length; i++) {
      formatted[i].unreadCount = unreadMap.get(rows[i].id) || 0;
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
  const { Ticket, User, Attachment } = getModels();

  const ticket = await Ticket.findByPk(req.params.id, {
    include: [
      { model: User, as: 'author', attributes: ['id', 'displayName', 'avatarPath'] },
      { model: User, as: 'assignee', attributes: ['id', 'displayName'] },
      { model: User, as: 'createdBy', attributes: ['id', 'displayName'] },
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

  broadcastToRoom(ticket.id, { type: 'ticket_updated', data: { ticketId: ticket.id } });
  if (ticket.assigneeId && ticket.assigneeId !== req.user.sub) {
    sendToUser(ticket.assigneeId, { type: 'tickets_updated' });
  }
  if (ticket.authorId !== req.user.sub) {
    sendToUser(ticket.authorId, { type: 'tickets_updated' });
  }
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
  // AGENT ограничен своими тикетами, SENIOR_AGENT и ADMIN — нет
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
      { model: User, as: 'author', attributes: ['id', 'displayName', 'avatarPath'] },
      { model: User, as: 'assignee', attributes: ['id', 'displayName'] },
      { model: User, as: 'createdBy', attributes: ['id', 'displayName'] },
      { model: Attachment, attributes: ['id', 'originalName', 'mimeType', 'size', 'createdAt'] }
    ]
  });
  res.json({ data: formatTicket(full, req.user) });

  // Оповещаем участников чата о смене статуса через WS
  const statusLabels = { IN_PROGRESS: 'В работе', WAITING_FOR_USER: 'Ожидает ответа', RESOLVED: 'Решён', CLOSED: 'Закрыт' };

  broadcastToRoom(ticket.id, {
    type: 'status_changed',
    data: { status, ticketId: ticket.id }
  });

  // Системное сообщение в чат
  await createSystemMessage(ticket.id, `Статус изменён: ${statusLabels[status] || status}`);

  // Обновление списка тикетов у участников
  sendToUser(ticket.authorId, { type: 'tickets_updated' });
  if (ticket.assigneeId && ticket.assigneeId !== req.user.sub) {
    sendToUser(ticket.assigneeId, { type: 'tickets_updated' });
  }

  // Уведомление автору тикета
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

  // Удаляем уведомления NEW_TICKET у всех агентов (тикет взят)
  const { Notification: NotifModel } = getModels();
  await NotifModel.destroy({
    where: {
      type: 'NEW_TICKET',
      [Op.or]: [
        literal(`"data"->>'ticketId' = '${ticket.id}'`),       // PostgreSQL
        literal(`json_extract("data", '$.ticketId') = '${ticket.id}'`) // SQLite
      ]
    }
  }).catch(() => {});

  // Перезагружаем тикет с ассоциациями для корректного ответа
  const { User, Attachment } = getModels();
  const full = await Ticket.findByPk(ticket.id, {
    include: [
      { model: User, as: 'author', attributes: ['id', 'displayName', 'avatarPath'] },
      { model: User, as: 'assignee', attributes: ['id', 'displayName'] },
      { model: User, as: 'createdBy', attributes: ['id', 'displayName'] },
      { model: Attachment, attributes: ['id', 'originalName', 'mimeType', 'size', 'createdAt'] }
    ]
  });

  const agentName = full.assignee?.displayName || 'Агент';

  res.json({ data: formatTicket(full, req.user) });

  // Системное сообщение в чат с реальным именем
  await createSystemMessage(ticket.id, `Вашим обращением занялся ${agentName}`);

  // Broadcast обновление тикета всем в комнате
  broadcastToRoom(ticket.id, {
    type: 'ticket_updated',
    data: { ticketId: ticket.id, status: ticket.status }
  });

  // tickets_updated для автора + всех агентов (тикет ушёл из очереди)
  sendToUser(ticket.authorId, { type: 'tickets_updated' });
  const allAgents = await User.findAll({ where: { role: STAFF_ROLES, isActive: true }, attributes: ['id'] });
  for (const a of allAgents) {
    if (a.id !== req.user.sub) sendToUser(a.id, { type: 'tickets_updated' });
  }

  // Уведомление автору тикета
  notify(ticket.authorId, {
    type: 'TICKET_ASSIGNED',
    title: `Обращение #${ticket.number}`,
    body: `Вашим обращением занимается ${agentName}`,
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

  // AGENT ограничен своими, SENIOR_AGENT и ADMIN — нет
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

  // WS обновления
  broadcastToRoom(ticket.id, { type: 'ticket_updated', data: { ticketId: ticket.id } });
  sendToUser(ticket.authorId, { type: 'tickets_updated' });
  if (ticket.assigneeId && ticket.assigneeId !== req.user.sub) {
    sendToUser(ticket.assigneeId, { type: 'tickets_updated' });
  }
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
      { model: User, as: 'author', attributes: ['id', 'displayName', 'avatarPath'] },
      { model: User, as: 'assignee', attributes: ['id', 'displayName'] },
      { model: User, as: 'createdBy', attributes: ['id', 'displayName'] },
      { model: Attachment, attributes: ['id', 'originalName', 'mimeType', 'size', 'createdAt'] }
    ]
  });

  res.json({ data: formatTicket(full, req.user) });

  // Системное сообщение в чат
  await createSystemMessage(ticket.id, `Обращение закрыто пользователем`);

  // Оповещаем участников чата о закрытии через WS
  broadcastToRoom(ticket.id, {
    type: 'status_changed',
    data: { status: 'CLOSED', ticketId: ticket.id }
  });

  // tickets_updated для assignee
  if (ticket.assigneeId) {
    sendToUser(ticket.assigneeId, { type: 'tickets_updated' });
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
    // Обычный AGENT readonly для чужих тикетов, SENIOR_AGENT/ADMIN — нет
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
    createdBy: plain.createdBy || null,
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
