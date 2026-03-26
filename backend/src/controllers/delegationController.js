import { getModels } from '../models/index.js';
import { DelegationStatus, Role, TicketStatus } from '../models/enums.js';
import { sendToUser, broadcastToRoom } from '../websocket/wsServer.js';

/**
 * POST /api/tickets/:id/delegate
 */
export async function createDelegation(req, res) {
  const { toAgentId, message } = req.body;
  const ticketId = req.params.id;

  if (!toAgentId) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Укажите агента для делегирования' }
    });
  }

  const { Ticket, User, DelegationRequest } = getModels();

  const ticket = await Ticket.findByPk(ticketId);
  if (!ticket) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Тикет не найден' } });
  }

  // Только текущий assignee может делегировать
  if (ticket.assigneeId !== req.user.sub) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Только назначенный агент может делегировать' }
    });
  }

  // Нельзя себе
  if (toAgentId === req.user.sub) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Нельзя делегировать самому себе' }
    });
  }

  // Проверяем целевого агента
  const toAgent = await User.findByPk(toAgentId);
  if (!toAgent || (toAgent.role !== Role.AGENT && toAgent.role !== Role.ADMIN)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Указанный пользователь не является агентом' }
    });
  }

  // Нет ли уже PENDING запроса
  const existing = await DelegationRequest.findOne({
    where: { ticketId, status: DelegationStatus.PENDING }
  });
  if (existing) {
    return res.status(409).json({
      error: { code: 'DELEGATION_PENDING', message: 'Уже есть активный запрос делегирования' }
    });
  }

  const delegation = await DelegationRequest.create({
    ticketId,
    fromAgentId: req.user.sub,
    toAgentId,
    message: message || null
  });

  const full = await DelegationRequest.findByPk(delegation.id, {
    include: [
      { model: Ticket, attributes: ['id', 'number', 'title'] },
      { model: User, as: 'fromAgent', attributes: ['id', 'displayName'] },
      { model: User, as: 'toAgent', attributes: ['id', 'displayName'] }
    ]
  });

  // WS уведомление целевому агенту
  sendToUser(toAgentId, {
    type: 'notification',
    data: {
      type: 'DELEGATION_REQUEST',
      title: 'Запрос на делегирование',
      body: `${full.fromAgent.displayName} предлагает тикет #${full.Ticket.number}: ${full.Ticket.title}`,
      data: { ticketId, delegationId: delegation.id }
    }
  });

  res.status(201).json({ data: formatDelegation(full) });
}

/**
 * PUT /api/delegations/:id/respond
 */
export async function respondDelegation(req, res) {
  const { accept } = req.body;
  if (typeof accept !== 'boolean') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Укажите accept: true или false' }
    });
  }

  const { DelegationRequest, Ticket, User } = getModels();

  const delegation = await DelegationRequest.findByPk(req.params.id, {
    include: [
      { model: Ticket },
      { model: User, as: 'fromAgent', attributes: ['id', 'displayName'] },
      { model: User, as: 'toAgent', attributes: ['id', 'displayName'] }
    ]
  });

  if (!delegation) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Запрос не найден' } });
  }

  // Только целевой агент может отвечать
  if (delegation.toAgentId !== req.user.sub) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Нет прав' } });
  }

  if (delegation.status !== DelegationStatus.PENDING) {
    return res.status(400).json({
      error: { code: 'ALREADY_RESPONDED', message: 'На этот запрос уже дан ответ' }
    });
  }

  if (accept) {
    // === ПРИНЯТО ===
    delegation.status = DelegationStatus.ACCEPTED;
    delegation.respondedAt = new Date();
    await delegation.save();

    // Переназначаем тикет
    const ticket = delegation.Ticket;
    ticket.assigneeId = delegation.toAgentId;
    await ticket.save();

    const newAgentName = delegation.toAgent.displayName;

    // Уведомление пользователю (автору тикета)
    sendToUser(ticket.authorId, {
      type: 'notification',
      data: {
        type: 'AGENT_CHANGED',
        title: `Обращение #${ticket.number}`,
        body: `Теперь вашим обращением занимается ${newAgentName}`,
        data: { ticketId: ticket.id }
      }
    });

    // WS broadcast в комнату тикета
    broadcastToRoom(ticket.id, {
      type: 'agent_changed',
      data: { newAgent: newAgentName }
    });

    // tickets_updated для всех участников
    sendToUser(ticket.authorId, { type: 'tickets_updated' });
    sendToUser(delegation.fromAgentId, { type: 'tickets_updated' });
    sendToUser(delegation.toAgentId, { type: 'tickets_updated' });

    // Уведомление бывшему агенту
    sendToUser(delegation.fromAgentId, {
      type: 'notification',
      data: {
        type: 'DELEGATION_ACCEPTED',
        title: 'Делегирование принято',
        body: `${delegation.toAgent.displayName} принял тикет #${ticket.number}`,
        data: { ticketId: ticket.id }
      }
    });
  } else {
    // === ОТКЛОНЕНО ===
    delegation.status = DelegationStatus.REJECTED;
    delegation.respondedAt = new Date();
    await delegation.save();

    // Уведомление отправителю
    sendToUser(delegation.fromAgentId, {
      type: 'notification',
      data: {
        type: 'DELEGATION_REJECTED',
        title: 'Делегирование отклонено',
        body: `${delegation.toAgent.displayName} отклонил тикет #${delegation.Ticket.number}`,
        data: { ticketId: delegation.ticketId }
      }
    });
  }

  res.json({ data: formatDelegation(delegation) });
}

/**
 * GET /api/delegations/incoming
 */
export async function listIncoming(req, res) {
  const { status } = req.query;
  const { DelegationRequest, Ticket, User } = getModels();

  const where = { toAgentId: req.user.sub };
  if (status) where.status = status;
  else where.status = DelegationStatus.PENDING;

  const rows = await DelegationRequest.findAll({
    where,
    include: [
      { model: Ticket, attributes: ['id', 'number', 'title', 'status', 'priority'] },
      { model: User, as: 'fromAgent', attributes: ['id', 'displayName'] }
    ],
    order: [['createdAt', 'DESC']]
  });

  res.json({ data: rows.map(formatDelegation) });
}

/**
 * GET /api/delegations/outgoing
 */
export async function listOutgoing(req, res) {
  const { DelegationRequest, Ticket, User } = getModels();

  const rows = await DelegationRequest.findAll({
    where: { fromAgentId: req.user.sub },
    include: [
      { model: Ticket, attributes: ['id', 'number', 'title', 'status'] },
      { model: User, as: 'toAgent', attributes: ['id', 'displayName'] }
    ],
    order: [['createdAt', 'DESC']],
    limit: 50
  });

  res.json({ data: rows.map(formatDelegation) });
}

/**
 * GET /api/delegations/incoming/count
 */
export async function countIncoming(req, res) {
  const { DelegationRequest } = getModels();

  const count = await DelegationRequest.count({
    where: { toAgentId: req.user.sub, status: DelegationStatus.PENDING }
  });

  res.json({ data: { count } });
}

function formatDelegation(d) {
  const plain = d.toJSON ? d.toJSON() : { ...d };
  return {
    id: plain.id,
    ticketId: plain.ticketId,
    ticket: plain.Ticket || null,
    fromAgent: plain.fromAgent || null,
    toAgent: plain.toAgent || null,
    status: plain.status,
    message: plain.message,
    createdAt: plain.createdAt,
    respondedAt: plain.respondedAt
  };
}
