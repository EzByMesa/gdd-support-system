# Push-уведомления и сервер уведомлений

## Архитектура

Двухуровневая система уведомлений:

```
┌──────────────┐
│ Событие      │ (новое сообщение, смена статуса, делегирование...)
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌────────────────────┐
│ Notification │────→│ Сохранение в БД    │ (таблица notifications)
│ Service      │     └────────────────────┘
│              │     ┌────────────────────┐
│              │────→│ Web Push (VAPID)   │ (если есть подписка)
│              │     └────────────────────┘
│              │     ┌────────────────────┐
│              │────→│ WebSocket (online) │ (если подключён к WS)
│              │     └────────────────────┘
└──────────────┘
```

**3 канала доставки:**
1. **БД** — всегда. Уведомление сохраняется для показа в UI (колокольчик)
2. **Web Push** — браузерный push, работает даже если вкладка закрыта
3. **WebSocket** — мгновенная доставка, если пользователь онлайн

## Web Push (VAPID)

### Настройка (генерация ключей при Setup или вручную)
```javascript
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);
```

### API: подписка клиента
```
POST /api/push/subscribe
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
→ 201 { "data": { "id": "sub-uuid" } }

DELETE /api/push/subscribe
→ 204
```

### На клиенте
```javascript
// services/push.js

async function subscribeToPush() {
  const registration = await navigator.serviceWorker.register('/sw.js');

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });

  await api.post('/push/subscribe', subscription.toJSON());
}
```

### Service Worker (sw.js)
```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/notification.png',
      badge: '/icons/badge.png',
      data: data.data,  // { ticketId, type }
      tag: data.tag      // группировка уведомлений
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { ticketId } = event.notification.data;

  event.waitUntil(
    clients.openWindow(`/#/tickets/${ticketId}`)
  );
});
```

## Типы уведомлений

| Тип | Получатель | Заголовок | Пример тела |
|-----|-----------|-----------|-------------|
| `NEW_MESSAGE` | Автор тикета | Обращение #42 | Ласковый Котёнок ответил на ваше обращение |
| `NEW_MESSAGE` | Агент | Тикет #42 | Новое сообщение от пользователя |
| `STATUS_CHANGED` | Автор тикета | Обращение #42 | Статус изменён: В работе |
| `TICKET_ASSIGNED` | Автор тикета | Обращение #42 | Вашим обращением занимается Ласковый Котёнок |
| `DELEGATION_REQUEST` | Агент-цель | Запрос на делегирование | Иванов предлагает тикет #42 |
| `DELEGATION_ACCEPTED` | Агент-источник | Делегирование принято | Петров принял тикет #42 |
| `DELEGATION_REJECTED` | Агент-источник | Делегирование отклонено | Петров отклонил тикет #42 |
| `AGENT_CHANGED` | Автор тикета | Обращение #42 | Ваш агент: Смелый Пингвин |

## Сервис уведомлений

```javascript
// services/notification.js

async function notify(userId, { type, title, body, data = {} }) {
  // 1. Сохраняем в БД
  const notification = await Notification.create({
    userId, type, title, body, data
  });

  // 2. Web Push (если есть подписки)
  const subscriptions = await PushSubscription.findAll({ where: { userId } });
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify({ title, body, data: { ...data, notificationId: notification.id }, tag: `ticket-${data.ticketId}` })
      );
    } catch (err) {
      if (err.statusCode === 410) {
        await sub.destroy();  // подписка протухла
      }
    }
  }

  // 3. WebSocket (если онлайн)
  sendToUser(userId, {
    type: 'notification',
    data: { id: notification.id, type, title, body, data: data, createdAt: notification.createdAt }
  });
}
```

## API уведомлений

```
GET    /api/notifications?unread=true&limit=20   — список уведомлений
PUT    /api/notifications/:id/read               — пометить прочитанным
PUT    /api/notifications/read-all               — пометить все прочитанными
GET    /api/notifications/count                  — количество непрочитанных
```

## UI: Колокольчик уведомлений

- Иконка колокольчика в header
- Badge с количеством непрочитанных
- Клик → dropdown со списком уведомлений
- Каждое уведомление — кликабельное (навигация к тикету)
- "Отметить все как прочитанные"
- Адаптивно на мобильных: полноэкранный список

## WebSocket: канал уведомлений

Помимо комнат тикетов, каждый подключённый пользователь автоматически подписан на персональный канал уведомлений:

```javascript
// При подключении к WS (даже без ticketId)
const ws = new WebSocket(`ws://host/ws?token=${accessToken}`);

// Сервер → Клиент (real-time уведомление)
{
  "type": "notification",
  "data": {
    "id": "notif-uuid",
    "type": "NEW_MESSAGE",
    "title": "Обращение #42",
    "body": "Ласковый Котёнок ответил...",
    "data": { "ticketId": "uuid" },
    "createdAt": "..."
  }
}
```

Это позволяет обновлять badge колокольчика в реальном времени без перезагрузки страницы.
