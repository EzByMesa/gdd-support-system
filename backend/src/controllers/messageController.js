import { getModels } from '../models/index.js';
import { Role } from '../models/enums.js';

/**
 * GET /api/tickets/:id/messages
 */
export async function listMessages(req, res) {
  const { page = 1, limit = 50 } = req.query;
  const ticketId = req.params.id;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { Ticket, TicketMessage, User, Attachment } = getModels();

  // Проверяем доступ
  const ticket = await Ticket.findByPk(ticketId);
  if (!ticket) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Тикет не найден' } });
  }
  if (req.user.role === Role.USER && ticket.authorId !== req.user.sub) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Нет доступа' } });
  }

  const { count, rows } = await TicketMessage.findAndCountAll({
    where: { ticketId },
    include: [
      { model: User, as: 'author', attributes: ['id', 'displayName', 'role'] },
      { model: Attachment, attributes: ['id', 'originalName', 'mimeType', 'size'] }
    ],
    order: [['createdAt', 'ASC']],
    limit: parseInt(limit),
    offset
  });

  const messages = rows.map(msg => {
    if (msg.isSystem) {
      return {
        id: msg.id, content: msg.content, isSystem: true,
        author: { id: null, displayName: 'Система' },
        attachments: [], createdAt: msg.createdAt
      };
    }

    return {
      id: msg.id,
      content: msg.content,
      author: msg.author
        ? { id: msg.author.id, displayName: msg.author.displayName, role: msg.author.role }
        : { id: null, displayName: 'Удалённый пользователь', role: 'USER' },
      attachments: (msg.Attachments || []).map(a => ({
        id: a.id, originalName: a.originalName, mimeType: a.mimeType, size: a.size
      })),
      createdAt: msg.createdAt
    };
  });

  res.json({
    data: messages,
    pagination: {
      page: parseInt(page), limit: parseInt(limit),
      total: count, totalPages: Math.ceil(count / parseInt(limit))
    }
  });
}
