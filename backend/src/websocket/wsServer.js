import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { getModels } from '../models/index.js';
import { handleChatMessage, handleTyping, sendHistory } from './chatHandler.js';

// Комнаты тикетов: Map<ticketId, Map<ws, userInfo>>
const ticketRooms = new Map();

// Персональные каналы: Map<userId, Set<ws>>
const userChannels = new Map();

/**
 * Инициализация WebSocket сервера
 */
export function initWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const ticketId = url.searchParams.get('ticketId');

    // Аутентификация
    let user;
    try {
      user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      ws.close(4001, 'Unauthorized');
      return;
    }

    // Загружаем displayName из БД (JWT не содержит его)
    try {
      const { User } = getModels();
      const dbUser = await User.findByPk(user.sub, { attributes: ['displayName'] });
      if (dbUser) user.displayName = dbUser.displayName;
    } catch { /* fallback to login */ }
    if (!user.displayName) user.displayName = user.login;

    ws._user = user;
    ws._ticketId = ticketId;

    // Подписка на персональный канал (всегда)
    if (!userChannels.has(user.sub)) {
      userChannels.set(user.sub, new Set());
    }
    userChannels.get(user.sub).add(ws);

    // Подписка на комнату тикета (если указан)
    if (ticketId) {
      if (!ticketRooms.has(ticketId)) {
        ticketRooms.set(ticketId, new Map());
      }
      ticketRooms.get(ticketId).set(ws, {
        userId: user.sub,
        role: user.role,
        login: user.login,
        displayName: user.displayName
      });

      // Отправляем историю
      await sendHistory(ws, ticketId, user);
    }

    // Обработка сообщений
    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case 'message':
            if (ticketId) {
              await handleChatMessage(ws, ticketId, user, msg);
            }
            break;
          case 'typing':
            if (ticketId) {
              handleTyping(ws, ticketId, user);
            }
            break;
        }
      } catch (err) {
        ws.send(JSON.stringify({
          type: 'error',
          data: { code: 'INVALID_MESSAGE', message: err.message }
        }));
      }
    });

    // Отключение
    ws.on('close', () => {
      // Удаляем из персонального канала
      const channel = userChannels.get(user.sub);
      if (channel) {
        channel.delete(ws);
        if (channel.size === 0) userChannels.delete(user.sub);
      }

      // Удаляем из комнаты тикета
      if (ticketId) {
        const room = ticketRooms.get(ticketId);
        if (room) {
          room.delete(ws);
          if (room.size === 0) ticketRooms.delete(ticketId);
        }
      }
    });
  });

  console.log('[WS] WebSocket сервер запущен на /ws');
  return wss;
}

/**
 * Отправить сообщение всем участникам комнаты тикета
 */
export function broadcastToRoom(ticketId, message, excludeWs = null) {
  const room = ticketRooms.get(ticketId);
  if (!room) return;

  for (const [client, userInfo] of room) {
    if (client === excludeWs || client.readyState !== WebSocket.OPEN) continue;
    client.send(JSON.stringify(message));
  }
}

/**
 * Отправить анонимизированное сообщение пользователям в комнате,
 * а агентам/админам — с реальными данными
 */
export function broadcastToRoomAnonymized(ticketId, messageForUser, messageForAgent, excludeWs = null) {
  const room = ticketRooms.get(ticketId);
  if (!room) return;

  for (const [client, userInfo] of room) {
    if (client === excludeWs || client.readyState !== WebSocket.OPEN) continue;

    const msg = userInfo.role === 'USER' ? messageForUser : messageForAgent;
    client.send(JSON.stringify(msg));
  }
}

/**
 * Отправить сообщение конкретному пользователю (все его подключения)
 */
export function sendToUser(userId, message) {
  const channel = userChannels.get(userId);
  if (!channel) return;

  const data = JSON.stringify(message);
  for (const ws of channel) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

/**
 * Проверить, онлайн ли пользователь (есть ли активные WS-соединения)
 */
export function isUserOnline(userId) {
  const channel = userChannels.get(userId);
  return !!(channel && channel.size > 0);
}

/**
 * Получить информацию о комнате
 */
export function getRoomInfo(ticketId) {
  const room = ticketRooms.get(ticketId);
  if (!room) return { size: 0, users: [] };
  return {
    size: room.size,
    users: Array.from(room.values())
  };
}
