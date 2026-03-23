# Фаза 5 — Чат внутри тикетов (WebSocket) + Анонимные агенты

## Архитектура

WebSocket-сервер на `ws`, поднимается вместе с Express.

```
Клиент ←──WebSocket──→ WS-сервер
                            │
                            ├── Аутентификация (JWT)
                            ├── Подписка на комнату (ticketId)
                            ├── Анонимизация имён агентов для пользователей
                            └── Broadcast + Push-уведомления
```

## Подключение

```javascript
const ws = new WebSocket(`ws://host/ws?token=${accessToken}&ticketId=${ticketId}`);
```

Сервер при подключении:
1. Валидирует JWT из `token`
2. Проверяет доступ к тикету
3. Для AGENT на чужом тикете (readonly) — подключение запрещено (WS только для участников)
4. Добавляет в комнату `ticket:{ticketId}`
5. Отправляет историю последних 50 сообщений (с анонимизацией для USER)

## Анонимизация сообщений для USER

Когда сообщения отправляются пользователю, имя агента заменяется на псевдоним:

```javascript
// На сервере перед отправкой пользователю
function anonymizeForUser(message, ticketId) {
  if (message.author.role === 'AGENT' || message.author.role === 'ADMIN') {
    const alias = await getAgentAlias(message.author.id, ticketId);
    return {
      ...message,
      author: {
        id: 'agent',           // скрываем реальный ID
        displayName: alias,     // "Ласковый Котёнок"
        role: 'AGENT'
      }
    };
  }
  return message;
}
```

**Важно:** Агенты и Админы видят реальные имена друг друга. Анонимизация только для USER.

## Протокол сообщений (JSON)

### Клиент → Сервер

```json
{ "type": "message", "content": "Текст", "attachmentIds": ["uuid1"] }
{ "type": "typing" }
```

### Сервер → Клиент

```json
// Новое сообщение (для USER — с анонимным именем агента)
{
  "type": "message",
  "data": {
    "id": "msg-uuid",
    "content": "Текст",
    "author": { "id": "agent", "displayName": "Ласковый Котёнок", "role": "AGENT" },
    "attachments": [...],
    "createdAt": "2025-01-15T10:30:00Z"
  }
}

// Для AGENT/ADMIN — то же, но с реальным именем:
{
  "type": "message",
  "data": {
    "author": { "id": "real-uuid", "displayName": "Иванов Иван", "role": "AGENT" },
    ...
  }
}

// Typing (для USER — анонимно)
{ "type": "typing", "data": { "displayName": "Ласковый Котёнок" } }

// История
{ "type": "history", "data": { "messages": [...] } }

// Смена статуса
{ "type": "status_changed", "data": { "status": "IN_PROGRESS" } }

// Смена агента (при делегировании — для USER)
{ "type": "agent_changed", "data": { "newAgent": "Смелый Пингвин" } }

// Ошибка
{ "type": "error", "data": { "code": "UNAUTHORIZED", "message": "..." } }
```

## Автоматические действия

- Сообщение от USER при статусе `WAITING_FOR_USER` → автопереход в `IN_PROGRESS`
- Каждое сообщение обновляет `ticket.updatedAt`
- Push-уведомление всем участникам (кроме отправителя)

## Хранение

Все сообщения сохраняются в `TicketMessage` через Sequelize.
WebSocket — только real-time. При переподключении — история из БД.

## REST-fallback

```
GET /api/tickets/:id/messages?page=1&limit=50
→ { data: [...], pagination: {...} }
```

Для USER — сообщения возвращаются с анонимизированными именами агентов.

## Управление комнатами

```javascript
// rooms: Map<string, Map<WebSocket, { userId, role }>>

function broadcastToRoom(ticketId, message, excludeWs) {
  const room = rooms.get(`ticket:${ticketId}`);
  if (!room) return;

  for (const [client, userInfo] of room) {
    if (client === excludeWs || client.readyState !== WebSocket.OPEN) continue;

    // Анонимизация для пользователей
    const msg = userInfo.role === 'USER'
      ? anonymizeForUser(message, ticketId)
      : message;

    client.send(JSON.stringify(msg));
  }
}
```
