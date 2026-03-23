import { getModels } from '../models/index.js';
import { Role } from '../models/enums.js';
import { getOrCreateAlias } from '../services/agentAlias.js';

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

  // Анонимизация для USER
  const messages = await Promise.all(rows.map(async (msg) => {
    const author = msg.author;
    const attachments = (msg.Attachments || []).map(a => ({
      id: a.id, originalName: a.originalName, mimeType: a.mimeType, size: a.size
    }));

    const isAgentAuthor = author.role === Role.AGENT || author.role === Role.ADMIN;

    if (req.user.role === Role.USER && isAgentAuthor) {
      const alias = await getOrCreateAlias(author.id, ticketId);
      return {
        id: msg.id,
        content: msg.content,
        author: { id: 'agent', displayName: alias, role: 'AGENT' },
        attachments,
        createdAt: msg.createdAt
      };
    }

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
  }));

  res.json({
    data: messages,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      totalPages: Math.ceil(count / parseInt(limit))
    }
  });
}
