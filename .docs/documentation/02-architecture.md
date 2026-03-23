# 02. Архитектура системы

## Обзор

GDD Support System — монорепозиторий (npm workspaces) с двумя пакетами: `backend` и `frontend`. Связь между ними осуществляется через REST API и WebSocket.

```
gdd_support_system/
├── backend/          # Node.js + Express + Sequelize
│   └── src/
│       ├── app.js                # Точка входа — HTTP-сервер + WebSocket
│       ├── controllers/          # HTTP-контроллеры
│       ├── middleware/           # auth, setupGuard, errorHandler
│       ├── models/               # Sequelize модели (12 штук)
│       ├── routes/               # Express-роутеры
│       ├── services/             # Бизнес-логика
│       ├── setup/                # Setup Wizard (контроллер + роуты)
│       ├── docs/                 # Swagger-спецификация
│       ├── utils/                # dbCompat (iLike), asyncHandler
│       └── websocket/            # WS-сервер и обработчик чата
├── frontend/         # Vanilla JS + Vite
│   └── src/
│       ├── main.js               # Точка входа + роуты
│       ├── components/           # UI-компоненты
│       ├── pages/                # Страницы приложения
│       ├── services/             # api, auth, websocket, push, notifications
│       ├── router/               # SPA hash-роутер
│       ├── styles/               # CSS дизайн-система
│       └── utils/                # dom, format, validate
└── .docs/            # Документация
```

---

## Backend

### Стек

| Технология | Назначение |
|-----------|-----------|
| Node.js 20 | Среда выполнения |
| Express.js | HTTP-фреймворк |
| Sequelize | ORM (PostgreSQL + SQLite) |
| ws | WebSocket-сервер |
| jsonwebtoken | JWT-авторизация |
| bcryptjs | Хэширование паролей |
| multer | Загрузка файлов |
| web-push | Web Push уведомления (VAPID) |
| swagger-ui-express | Swagger UI |
| @xenova/transformers | ML-модель embeddings |
| dotenv | Переменные окружения |

### Точка входа (`app.js`)

Файл `backend/src/app.js` создаёт HTTP-сервер через Node.js `http.createServer(app)`, подключает все middleware и роуты, затем передаёт сервер в `initWebSocket`. Это позволяет WebSocket и HTTP использовать один и тот же порт (3000).

Порядок инициализации при старте:
1. Если задана `DATABASE_URL` — подключение к БД, `sequelize.authenticate()`
2. `checkSetupState()` — проверка завершённости Setup Wizard
3. `initVapid()` — инициализация VAPID-ключей для Web Push
4. `initWebSocket(server)` — WebSocket-сервер на пути `/ws`
5. `server.listen(PORT)`

### Middleware

| Файл | Назначение |
|------|-----------|
| `auth.js` | `authenticate` — проверка Bearer JWT; `authorize(...roles)` — проверка роли; `requireAdmin` — только ADMIN |
| `setupGuard.js` | Блокирует все запросы (кроме `/api/setup`) пока Setup Wizard не завершён |
| `errorHandler.js` | Глобальный обработчик ошибок Express |

### Sequelize модели (12 штук)

| Модель | Таблица | Описание |
|--------|---------|----------|
| `User` | `users` | Пользователи системы (все роли) |
| `Ticket` | `tickets` | Обращения в поддержку |
| `TicketMessage` | `ticket_messages` | Сообщения в чате тикета |
| `Attachment` | `attachments` | Метаданные загруженных файлов |
| `TopicGroup` | `topic_groups` | Тематические группы (ML-кластеры) |
| `AgentAlias` | `agent_aliases` | Псевдонимы агентов по тикетам |
| `DelegationRequest` | `delegation_requests` | Запросы делегирования |
| `PushSubscription` | `push_subscriptions` | Web Push подписки |
| `Notification` | `notifications` | Уведомления (БД-канал) |
| `AuthProvider` | `auth_providers` | Конфигурации провайдеров авторизации |
| `SystemSettings` | `system_settings` | Ключ-значение настроек системы |
| `SetupState` | `setup_states` | Состояние Setup Wizard (singleton) |

#### Связи модели Ticket

```
Ticket → belongsTo User (author)
Ticket → belongsTo User (assignee)
Ticket → belongsTo TopicGroup
Ticket → hasMany TicketMessage
Ticket → hasMany Attachment
Ticket → hasMany AgentAlias
Ticket → hasMany DelegationRequest
```

#### Перечисления (`enums.js`)

- **Role:** `USER`, `AGENT`, `ADMIN`
- **TicketStatus:** `OPEN`, `IN_PROGRESS`, `WAITING_FOR_USER`, `RESOLVED`, `CLOSED`
- **TicketPriority:** `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- **DelegationStatus:** `PENDING`, `ACCEPTED`, `REJECTED`
- **NotificationType:** `NEW_MESSAGE`, `STATUS_CHANGED`, `TICKET_ASSIGNED`, `DELEGATION_REQUEST`, `DELEGATION_ACCEPTED`, `DELEGATION_REJECTED`, `AGENT_CHANGED`
- **AuthProviderType:** `LOCAL`, `ONE_C`

### Поддержка двух СУБД

Утилита `utils/dbCompat.js` предоставляет функцию `iLike`, которая возвращает `{ [Op.iLike]: value }` для PostgreSQL и `{ [Op.like]: value }` для SQLite (SQLite не поддерживает `ILIKE` нативно). Это единственное место адаптации под диалект СУБД.

---

## Frontend

### Стек

| Технология | Назначение |
|-----------|-----------|
| Vanilla JS (ES Modules) | Без UI-фреймворков |
| Vite | Бандлер, dev-сервер с HMR |
| Кастомная CSS дизайн-система | CSS-переменные, компоненты |

**Принципиальный выбор:** TypeScript не используется. Только чистый JavaScript.

### SPA Hash-роутер

Роутер (`frontend/src/router/index.js`) использует `window.location.hash` (#-роутинг), что позволяет обслуживать SPA через любой статический сервер без серверной конфигурации.

Регистрация маршрутов в `main.js`:

| Маршрут | Страница | Доступ |
|---------|----------|--------|
| `/setup` | SetupWizardPage | guest |
| `/login` | LoginPage | guest |
| `/register` | RegisterPage | guest |
| `/` | TicketsPage | USER, AGENT, ADMIN |
| `/tickets/new` | NewTicketPage | USER, AGENT, ADMIN |
| `/tickets/:id` | TicketDetailPage | USER, AGENT, ADMIN |
| `/delegations` | DelegationsPage | AGENT, ADMIN |
| `/topic-groups` | TopicGroupsPage | AGENT, ADMIN |
| `/admin/dashboard` | AdminDashboardPage | ADMIN |
| `/admin/users` | AdminUsersPage | ADMIN |
| `/admin/tickets` | AdminTicketsPage | ADMIN |
| `/admin/topic-groups` | AdminTopicGroupsPage | ADMIN |
| `/admin/auth` | AdminAuthPage | ADMIN |
| `/admin/settings` | AdminSettingsPage | ADMIN |

### Компонентная система

Все компоненты — ES-классы. Паттерн:

```javascript
class MyComponent {
  constructor(props) { /* ... */ }
  // mount(container) или render() → DOM-элемент
}
```

Группы компонентов:
- `components/ui/` — Button, Badge, Spinner, Toast, Select, Modal, Input
- `components/layout/` — MainLayout, AdminLayout (навигация, хидер)
- `components/chat/` — ChatWindow, MessageBubble, TypingIndicator
- `components/tickets/` — DelegateModal, AttachmentUpload
- `components/notifications/` — NotificationBell, NotificationDropdown

### Сервисы frontend

| Сервис | Файл | Назначение |
|--------|------|-----------|
| ApiService | `services/api.js` | Базовый HTTP-клиент, работа с JWT (Bearer), авто-рефреш токена |
| AuthService | `services/auth.js` | Логин/логаут, хранение пользователя, восстановление сессии |
| WsClient | `services/websocket.js` | WebSocket-клиент с переподключением |
| PushService | `services/push.js` | Service Worker + Web Push подписка |
| NotificationService | `services/notifications.js` | Счётчик непрочитанных, обработка входящих |

---

## ML: автоматическая группировка тикетов

### Модель

- Библиотека: `@xenova/transformers`
- Модель: `Xenova/all-MiniLM-L6-v2`
- Размер: ~80 МБ (скачивается при первом запуске)
- Тип: `feature-extraction`, pooling `mean`, normalize `true`
- Выходной вектор: 384 измерения

### Алгоритм классификации (`services/topicGrouping.js`)

1. Конкатенация `title + " " + description` нового тикета
2. Генерация embedding через `generateEmbedding(text)`
3. Загрузка всех существующих `TopicGroup` с их embedding
4. Расчёт cosine similarity между вектором тикета и каждой группой
5. Если `maxScore >= порог (0.75 по умолчанию)` — тикет привязывается к существующей группе, embedding группы обновляется (скользящее среднее)
6. Если ниже порога — создаётся новая группа (`autoGenerated: true`), имя извлекается из первых 5 значимых слов заголовка

### Cosine Similarity

```javascript
dotProduct / (||a|| * ||b||)
```

Реализована вручную в `services/mlModel.js` без внешних зависимостей.

### Фоновая классификация

После создания тикета (`POST /api/tickets`) ответ возвращается немедленно, а классификация выполняется асинхронно (`classifyInBackground`) — не блокирует пользователя.

Переклассификация всех тикетов запускается через `POST /api/topic-groups/reclassify` (только ADMIN).

---

## Шифрование вложений

### Алгоритм: AES-256-GCM

- Алгоритм: `aes-256-gcm`
- Длина IV: 16 байт (случайный)
- Auth Tag: 16 байт
- Мастер-ключ: 32 байта, хранится в `SystemSettings` как hex-строка (64 символа)

### Структура файла на диске

```
[AuthTag (16 байт)] + [Зашифрованные данные]
```

### Именование файлов

На диске файлы хранятся под именем `UUID` без расширения (`storedName`). Оригинальное имя, MIME-тип и размер хранятся в таблице `Attachment`. IV хранится в поле `encryptionIV` как hex-строка.

---

## WebSocket

### Подключение

```
ws://localhost:3000/ws?token=<JWT>&ticketId=<UUID>
```

- `token` — обязательный параметр, JWT access token
- `ticketId` — опциональный параметр. Если не указан, устанавливается только персональный канал (для уведомлений)

### Комнаты и каналы

В памяти сервера хранятся две структуры:

```
ticketRooms: Map<ticketId, Map<ws, { userId, role, login }>>
userChannels: Map<userId, Set<ws>>
```

**Комнаты тикетов** — все участники тикета. Используются для чата.

**Персональные каналы** — все подключения одного пользователя. Используются для уведомлений.

### Типы сообщений (клиент → сервер)

| Тип | Поля | Описание |
|-----|------|----------|
| `message` | `content`, `attachmentIds?` | Отправить сообщение в чат |
| `typing` | — | Индикатор набора текста |

### Типы сообщений (сервер → клиент)

| Тип | Поля | Описание |
|-----|------|----------|
| `history` | `{ messages: [...] }` | История сообщений (при подключении) |
| `message` | `{ id, content, author, attachments, createdAt }` | Новое сообщение |
| `typing` | `{ displayName }` | Собеседник печатает |
| `status_changed` | `{ status }` | Статус тикета изменился |
| `agent_changed` | `{ newAgent }` / `{ newAgent, newAgentAlias }` | Агент изменён (после делегирования) |
| `notification` | `{ type, title, body, data, isRead, createdAt }` | Персональное уведомление |
| `error` | `{ code, message }` | Ошибка |

### Анонимизация в WebSocket

Сервер отправляет разные версии одного сообщения в зависимости от роли получателя:

- **USER** получает сообщения агента с псевдонимом (`displayName: "Ласковый Котёнок"`, `id: "agent"`)
- **AGENT/ADMIN** получают реальное имя + псевдоним (`displayName: "Иванов И.И."`, `alias: "Ласковый Котёнок"`)

---

## Авторизация

### JWT

- **Access token:** срок 15 минут, передаётся в `Authorization: Bearer <token>`
- **Refresh token:** срок 30 дней, хранится в httpOnly cookie `refreshToken`
- При истечении access token фронтенд автоматически вызывает `POST /api/auth/refresh` (ротация refresh token)

### Провайдеры авторизации

| Тип | Описание |
|-----|---------|
| `LOCAL` | Логин + пароль (bcrypt, cost factor 12) |
| `ONE_C` | Делегирование авторизации на сервер 1С |

Список активных провайдеров возвращает `GET /api/auth/providers` (публичный эндпоинт, используется для отображения кнопок входа на UI).
