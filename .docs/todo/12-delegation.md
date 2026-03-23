# Система делегирования задач

## Концепция

Агент, работающий с тикетом, может **делегировать** (передать) его другому агенту. Передача требует **подтверждения** от принимающего агента. При успешной передаче пользователь получает уведомление о смене агента (анонимное).

## Сценарий

```
1. Агент-А работает с тикетом #42
2. Агент-А нажимает "Делегировать" → выбирает Агента-Б → пишет причину
3. Агент-Б получает push-уведомление: "Вам предлагают тикет #42: Не работает печать"
4a. Агент-Б ПРИНИМАЕТ:
    → Тикет переназначается на Агента-Б
    → Агенту-Б генерируется новый анонимный псевдоним для этого тикета
    → Пользователь получает уведомление: "Теперь вашим обращением занимается Смелый Пингвин"
    → Агент-А получает уведомление: "Петров принял тикет #42"
4b. Агент-Б ОТКЛОНЯЕТ:
    → Тикет остаётся у Агента-А
    → Агент-А получает уведомление: "Петров отклонил делегирование тикета #42"
```

## API

### Создать запрос на делегирование
```
POST /api/tickets/:id/delegate
{
  "toAgentId": "uuid-агента-Б",
  "message": "Нужна помощь специалиста по 1С"  // опционально
}

→ 201 {
  "data": {
    "id": "delegation-uuid",
    "ticketId": "...",
    "fromAgent": { "id", "displayName" },
    "toAgent": { "id", "displayName" },
    "status": "PENDING",
    "message": "...",
    "createdAt": "..."
  }
}
```

Ограничения:
- Только текущий `assignee` может делегировать
- Нельзя делегировать самому себе
- Нельзя создать второй запрос пока первый `PENDING`
- Целевой агент должен иметь роль `AGENT` или `ADMIN`

### Ответить на запрос делегирования
```
PUT /api/delegations/:id/respond
{
  "accept": true   // или false
}

→ {
  "data": {
    "id": "delegation-uuid",
    "status": "ACCEPTED",   // или "REJECTED"
    "respondedAt": "..."
  }
}
```

### Список моих запросов на делегирование (входящие)
```
GET /api/delegations/incoming?status=PENDING

→ {
  "data": [
    {
      "id": "...",
      "ticket": { "id", "number", "title", "status" },
      "fromAgent": { "displayName" },
      "message": "...",
      "createdAt": "..."
    }
  ]
}
```

### Список отправленных запросов
```
GET /api/delegations/outgoing

→ {
  "data": [
    {
      "id": "...",
      "ticket": { "id", "number", "title" },
      "toAgent": { "displayName" },
      "status": "PENDING",
      "message": "...",
      "createdAt": "..."
    }
  ]
}
```

## Процесс на бэкенде (при ACCEPTED)

```javascript
async function acceptDelegation(delegationId, agentId) {
  const delegation = await DelegationRequest.findByPk(delegationId);

  // 1. Обновляем делегирование
  delegation.status = 'ACCEPTED';
  delegation.respondedAt = new Date();
  await delegation.save();

  // 2. Переназначаем тикет
  const ticket = await Ticket.findByPk(delegation.ticketId);
  ticket.assigneeId = delegation.toAgentId;
  await ticket.save();

  // 3. Генерируем анонимный псевдоним для нового агента
  const newAlias = await getOrCreateAlias(delegation.toAgentId, ticket.id);

  // 4. Уведомления
  // → Пользователю (автору тикета): "Ваш агент сменился на {newAlias}"
  await notify(ticket.authorId, {
    type: 'AGENT_CHANGED',
    title: `Обращение #${ticket.number}`,
    body: `Теперь вашим обращением занимается ${newAlias}`,
    data: { ticketId: ticket.id }
  });

  // → Бывшему агенту: "Петров принял тикет #42"
  await notify(delegation.fromAgentId, {
    type: 'DELEGATION_ACCEPTED',
    title: `Делегирование принято`,
    body: `Тикет #${ticket.number} передан`,
    data: { ticketId: ticket.id }
  });

  // 5. WebSocket: уведомить участников чата о смене агента
  broadcastToRoom(ticket.id, {
    type: 'agent_changed',
    data: { newAgent: newAlias }  // для USER — только псевдоним
  });
}
```

## UI для агента

### Кнопка "Делегировать" на странице тикета
- Показывается только текущему assignee
- Открывает модальное окно:
  - Выпадающий список агентов (только активные, кроме себя)
  - Поле "Причина" (опционально)
  - Кнопки: "Отправить запрос" / "Отмена"

### Индикатор входящих запросов
- Badge на кнопке/иконке делегирования в header
- Число: количество PENDING запросов
- Клик → список входящих запросов с кнопками "Принять" / "Отклонить"

### В списке тикетов
- Тикеты с PENDING делегированием помечаются значком (напр. стрелки)
