import { getModels } from '../models/index.js';
import { TicketStatus, Role } from '../models/enums.js';
import { broadcastToRoom, sendToUser, getRoomInfo } from './wsServer.js';
import { notify } from '../services/notification.js';
import { upsertReadStatus } from '../controllers/ticketController.js';

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

  const formatted = messages.map(msg => formatMessage(msg));

  ws.send(JSON.stringify({
    type: 'history',
    data: { messages: formatted }
  }));

  // Auto-mark as read при подключении к чату
  upsertReadStatus(user.sub, ticketId).catch(() => {});
}

/**
 * Обработать новое сообщение из чата
 */
export async function handleChatMessage(ws, ticketId, user, msg) {
  const { TicketMessage, Ticket, User, Attachment } = getModels();

  if (!msg.content || !msg.content.trim()) return;

  const ticket = await Ticket.findByPk(ticketId);
  if (!ticket) {
    ws.send(JSON.stringify({
      type: 'error',
      data: { code: 'NOT_FOUND', message: 'Тикет не найден' }
    }));
    return;
  }

  // Закрытый/решённый тикет — только чтение
  if (ticket.status === TicketStatus.CLOSED || ticket.status === TicketStatus.RESOLVED) {
    ws.send(JSON.stringify({
      type: 'error',
      data: { code: 'TICKET_CLOSED', message: 'Обращение закрыто. Чат доступен только для чтения.' }
    }));
    return;
  }

  // Проверяем права на запись: USER — только свой, AGENT — только назначенный, SENIOR_AGENT/ADMIN — любой
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

    broadcastToRoom(ticketId,
      { type: 'status_changed', data: { status: TicketStatus.IN_PROGRESS } }
    );
    if (ticket.assigneeId) sendToUser(ticket.assigneeId, { type: 'tickets_updated' });
  }

  // Обновляем updatedAt тикета
  ticket.changed('updatedAt', true);
  await ticket.save();

  // Формируем сообщение
  const formatted = formatMessage(full);
  broadcastToRoom(ticketId, { type: 'message', data: formatted }, ws);

  // Отправляем подтверждение отправителю
  ws.send(JSON.stringify({ type: 'message', data: formatted }));

  // Auto-mark read для всех в комнате
  const roomInfo = getRoomInfo(ticketId);
  for (const u of roomInfo.users) {
    upsertReadStatus(u.userId, ticketId).catch(() => {});
  }

  // Push/DB уведомления (не отправителю)
  const isStaff = [Role.AGENT, Role.SENIOR_AGENT, Role.ADMIN].includes(user.role);
  const author = full.author;

  if (isStaff && ticket.authorId !== user.sub) {
    notify(ticket.authorId, {
      type: 'NEW_MESSAGE',
      title: `Обращение #${ticket.number}`,
      body: `${author.displayName} ответил на ваше обращение`,
      data: { ticketId }
    }).catch(() => {});
  } else if (!isStaff && ticket.assigneeId) {
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
  broadcastToRoom(ticketId,
    { type: 'typing', data: { displayName: user.displayName || user.login, userId: user.sub } },
    ws
  );
}

/**
 * Форматировать сообщение (без анонимизации)
 */
function formatMessage(msg) {
  // Системные сообщения
  if (msg.isSystem) {
    return {
      id: msg.id,
      content: msg.content,
      isSystem: true,
      author: { id: null, displayName: 'Система' },
      attachments: [],
      createdAt: msg.createdAt
    };
  }

  const author = msg.author;
  const attachments = (msg.Attachments || []).map(a => ({
    id: a.id, originalName: a.originalName, mimeType: a.mimeType, size: a.size
  }));

  return {
    id: msg.id,
    content: msg.content,
    author: author
      ? { id: author.id, displayName: author.displayName, role: author.role }
      : { id: null, displayName: 'Удалённый пользователь', role: 'USER' },
    attachments,
    createdAt: msg.createdAt
  };
}
