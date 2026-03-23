import { getModels } from '../models/index.js';
import { TicketStatus, Role } from '../models/enums.js';
import { getOrCreateAlias } from '../services/agentAlias.js';
import { broadcastToRoomAnonymized } from './wsServer.js';
import { notify } from '../services/notification.js';

/**
 * Отправить историю последних сообщений при подключении
 */
export async function sendHistory(ws, ticketId, user) {
  const { TicketMessage, User, Attachment } = getModels();

  const messages = await TicketMessage.findAll({
    where: { ticketId },
    include: [
      { model: User, as: 'author', attributes: ['id', 'displayName', 'role'] },
      { model: Attachment, attributes: ['id', 'originalName', 'mimeType', 'size'] }
    ],
    order: [['createdAt', 'ASC']],
    limit: 50
  });

  const formatted = await Promise.all(
    messages.map(msg => formatMessage(msg, ticketId, user))
  );

  ws.send(JSON.stringify({
    type: 'history',
    data: { messages: formatted }
  }));
}

/**
 * Обработать новое сообщение из чата
 */
export async function handleChatMessage(ws, ticketId, user, msg) {
  const { TicketMessage, Ticket, User, Attachment } = getModels();

  if (!msg.content || !msg.content.trim()) return;

  // Проверяем доступ к тикету
  const ticket = await Ticket.findByPk(ticketId);
  if (!ticket) {
    ws.send(JSON.stringify({
      type: 'error',
      data: { code: 'NOT_FOUND', message: 'Тикет не найден' }
    }));
    return;
  }

  // Проверяем права: USER — только свой, AGENT — только назначенный на себя, ADMIN — любой
  if (user.role === Role.USER && ticket.authorId !== user.sub) return;
  if (user.role === Role.AGENT && ticket.assigneeId !== user.sub) return;

  // Сохраняем сообщение
  const message = await TicketMessage.create({
    content: msg.content.trim(),
    ticketId,
    authorId: user.sub
  });

  // Привязываем вложения если есть
  if (msg.attachmentIds && msg.attachmentIds.length > 0) {
    await Attachment.update(
      { messageId: message.id },
      { where: { id: msg.attachmentIds, uploadedById: user.sub } }
    );
  }

  // Загружаем полные данные
  const full = await TicketMessage.findByPk(message.id, {
    include: [
      { model: User, as: 'author', attributes: ['id', 'displayName', 'role'] },
      { model: Attachment, attributes: ['id', 'originalName', 'mimeType', 'size'] }
    ]
  });

  // Автосмена статуса: USER ответил при WAITING_FOR_USER
  if (user.role === Role.USER && ticket.status === TicketStatus.WAITING_FOR_USER) {
    ticket.status = TicketStatus.IN_PROGRESS;
    await ticket.save();

    // Уведомляем о смене статуса
    broadcastToRoomAnonymized(ticketId,
      { type: 'status_changed', data: { status: TicketStatus.IN_PROGRESS } },
      { type: 'status_changed', data: { status: TicketStatus.IN_PROGRESS } }
    );
  }

  // Обновляем updatedAt тикета
  ticket.changed('updatedAt', true);
  await ticket.save();

  // Формируем сообщения для user и agent
  const author = full.author;
  const attachments = (full.Attachments || []).map(a => ({
    id: a.id, originalName: a.originalName, mimeType: a.mimeType, size: a.size
  }));

  // Для USER — анонимизация
  let aliasName = null;
  if (author.role === Role.AGENT || author.role === Role.ADMIN) {
    aliasName = await getOrCreateAlias(author.id, ticketId);
  }

  const messageForUser = {
    type: 'message',
    data: {
      id: full.id,
      content: full.content,
      author: (author.role === Role.AGENT || author.role === Role.ADMIN)
        ? { id: 'agent', displayName: aliasName, role: 'AGENT' }
        : { id: author.id, displayName: author.displayName, role: author.role },
      attachments,
      createdAt: full.createdAt
    }
  };

  const messageForAgent = {
    type: 'message',
    data: {
      id: full.id,
      content: full.content,
      author: {
        id: author.id,
        displayName: author.displayName,
        role: author.role,
        alias: aliasName
      },
      attachments,
      createdAt: full.createdAt
    }
  };

  broadcastToRoomAnonymized(ticketId, messageForUser, messageForAgent, ws);

  // Отправляем подтверждение отправителю (с реальным или анонимным именем)
  const selfMsg = user.role === Role.USER ? messageForUser : messageForAgent;
  ws.send(JSON.stringify(selfMsg));

  // Push/DB уведомления (не отправителю)
  const isAgentSender = user.role === Role.AGENT || user.role === Role.ADMIN;

  if (isAgentSender && ticket.authorId !== user.sub) {
    // Агент написал → уведомить пользователя
    notify(ticket.authorId, {
      type: 'NEW_MESSAGE',
      title: `Обращение #${ticket.number}`,
      body: `${aliasName || 'Агент'} ответил на ваше обращение`,
      data: { ticketId }
    }).catch(() => {});
  } else if (!isAgentSender && ticket.assigneeId) {
    // Пользователь написал → уведомить агента
    notify(ticket.assigneeId, {
      type: 'NEW_MESSAGE',
      title: `Тикет #${ticket.number}`,
      body: `Новое сообщение от ${author.displayName}`,
      data: { ticketId }
    }).catch(() => {});
  }
}

/**
 * Обработать индикатор набора
 */
export async function handleTyping(ws, ticketId, user) {
  const isAgent = user.role === Role.AGENT || user.role === Role.ADMIN;

  if (isAgent) {
    const alias = await getOrCreateAlias(user.sub, ticketId);
    broadcastToRoomAnonymized(ticketId,
      { type: 'typing', data: { displayName: alias } },
      { type: 'typing', data: { displayName: user.login, userId: user.sub } },
      ws
    );
  } else {
    broadcastToRoomAnonymized(ticketId,
      { type: 'typing', data: { displayName: user.login } },
      { type: 'typing', data: { displayName: user.login, userId: user.sub } },
      ws
    );
  }
}

/**
 * Форматировать сообщение с учётом анонимизации
 */
async function formatMessage(msg, ticketId, requestUser) {
  const author = msg.author;
  const attachments = (msg.Attachments || []).map(a => ({
    id: a.id, originalName: a.originalName, mimeType: a.mimeType, size: a.size
  }));

  const isAgentAuthor = author.role === Role.AGENT || author.role === Role.ADMIN;

  // Для USER — анонимизируем имена агентов
  if (requestUser.role === Role.USER && isAgentAuthor) {
    const alias = await getOrCreateAlias(author.id, ticketId);
    return {
      id: msg.id,
      content: msg.content,
      author: { id: 'agent', displayName: alias, role: 'AGENT' },
      attachments,
      createdAt: msg.createdAt
    };
  }

  // Для агентов/админов — реальные данные + псевдоним
  let alias = null;
  if (isAgentAuthor) {
    alias = await getOrCreateAlias(author.id, ticketId);
  }

  return {
    id: msg.id,
    content: msg.content,
    author: {
      id: author.id,
      displayName: author.displayName,
      role: author.role,
      alias
    },
    attachments,
    createdAt: msg.createdAt
  };
}
