# 03. API Reference

## Базовый URL

```
http://localhost:3000/api
```

## Аутентификация

Большинство эндпоинтов требуют JWT в заголовке:

```http
Authorization: Bearer <access_token>
```

Access token возвращается при логине (`POST /api/auth/login`) и обновлении (`POST /api/auth/refresh`).

## Формат ответов

**Успешный ответ:**
```json
{
  "data": { ... }
}
```

**Список с пагинацией:**
```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**Ошибка:**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Описание ошибки"
  }
}
```

## Коды ошибок

| HTTP | Код | Описание |
|------|-----|----------|
| 400 | `VALIDATION_ERROR` | Неверные входные данные |
| 400 | `DB_CONNECTION_FAILED` | Не удалось подключиться к БД (Setup) |
| 400 | `STEPS_INCOMPLETE` | Не все шаги Setup завершены |
| 401 | `UNAUTHORIZED` | Требуется авторизация |
| 401 | `TOKEN_EXPIRED` | Access token истёк |
| 401 | `INVALID_CREDENTIALS` | Неверный логин или пароль |
| 403 | `FORBIDDEN` | Недостаточно прав |
| 403 | `ACCOUNT_DISABLED` | Учётная запись деактивирована |
| 403 | `REGISTRATION_DISABLED` | Самостоятельная регистрация отключена |
| 404 | `NOT_FOUND` | Ресурс не найден |
| 409 | `CONFLICT` | Конфликт (дубликат логина/email) |
| 409 | `DELEGATION_PENDING` | Уже есть активный запрос делегирования |
| 409 | `ADMIN_EXISTS` | Корневой администратор уже создан |
| 503 | — | Система не настроена (Setup Wizard не завершён) |

---

## Группа: Setup (Настройка системы)

### GET /api/setup/status

Проверить состояние настройки. Публичный эндпоинт.

**Ответ:**
```json
{
  "data": {
    "isComplete": false,
    "completedSteps": ["database", "admin"],
    "needsSetup": true
  }
}
```

### POST /api/setup/step/database

Шаг 1 — подключение к БД.

**Тело (PostgreSQL):**
```json
{
  "dbType": "postgres",
  "host": "localhost",
  "port": 5432,
  "database": "gdd_support",
  "username": "gdd",
  "password": "secret"
}
```

**Тело (SQLite):**
```json
{
  "dbType": "sqlite",
  "path": "/app/data/database.sqlite"
}
```

### POST /api/setup/step/admin

Шаг 2 — создание корневого администратора.

**Тело:**
```json
{
  "login": "admin",
  "password": "strongpassword",
  "displayName": "Администратор",
  "email": "admin@example.com"
}
```

### POST /api/setup/step/storage

Шаг 3 — настройка хранилища вложений.

**Тело:**
```json
{
  "storagePath": "/app/attachments"
}
```

### POST /api/setup/step/complete

Шаг 4 — завершение настройки. Записывает настройки по умолчанию. Возвращает access token для автологина.

**Ответ:**
```json
{
  "data": {
    "success": true,
    "accessToken": "<jwt>",
    "user": { "id": "...", "login": "admin", "role": "ADMIN", "isRootAdmin": true }
  }
}
```

---

## Группа: Auth (Авторизация)

### POST /api/auth/login

Вход по логину и паролю.

**Тело:**
```json
{
  "login": "user123",
  "password": "password"
}
```

**Ответ:**
```json
{
  "accessToken": "<jwt>",
  "user": {
    "id": "uuid",
    "login": "user123",
    "displayName": "Иван Иванов",
    "role": "USER",
    "isRootAdmin": false
  }
}
```

Refresh token устанавливается в httpOnly cookie `refreshToken`.

### POST /api/auth/register

Самостоятельная регистрация (если включена). Валидация: логин мин. 3 символа, только `[a-zA-Z0-9_.-]`; пароль мин. 8 символов.

**Тело:**
```json
{
  "login": "newuser",
  "password": "password123",
  "displayName": "Новый Пользователь",
  "email": "user@example.com"
}
```

Созданный пользователь всегда получает роль `USER`.

### POST /api/auth/1c

Авторизация через 1С.

**Тело:**
```json
{
  "login": "ivanov",
  "password": "1cpassword"
}
```

### POST /api/auth/refresh

Обновление access token. Читает refresh token из cookie.

**Ответ:**
```json
{
  "accessToken": "<new_jwt>"
}
```

### POST /api/auth/logout

Очистить refresh token cookie. Требует аутентификации.

### GET /api/auth/me

Получить данные текущего пользователя. Требует аутентификации.

### GET /api/auth/providers

Получить список активных провайдеров авторизации (публичный).

**Ответ:**
```json
{
  "data": [
    { "type": "LOCAL", "name": "Логин и пароль" },
    { "type": "ONE_C", "name": "Вход через 1С" }
  ]
}
```

---

## Группа: Tickets (Тикеты)

Все эндпоинты требуют аутентификации.

### POST /api/tickets

Создать тикет. Доступно всем ролям.

**Тело:**
```json
{
  "title": "Не работает принтер",
  "description": "Подробное описание проблемы...",
  "priority": "HIGH"
}
```

- `priority`: `LOW`, `MEDIUM` (по умолчанию), `HIGH`, `CRITICAL`
- После создания запускается фоновая ML-классификация

### GET /api/tickets

Список тикетов.

- **USER** видит только свои тикеты
- **AGENT** и **ADMIN** видят все тикеты

**Параметры запроса:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| `page` | number | Страница (по умолчанию 1) |
| `limit` | number | Размер страницы (по умолчанию 20) |
| `status` | string | Фильтр по статусу |
| `priority` | string | Фильтр по приоритету |
| `search` | string | Поиск по заголовку и описанию (iLike) |
| `assignee` | string | `me` — только назначенные на меня, `none` — без агента |

### GET /api/tickets/:id

Получить тикет по ID. USER может получить только свой тикет.

### PUT /api/tickets/:id

Обновить тикет (заголовок, описание). Только автор или AGENT/ADMIN.

### PUT /api/tickets/:id/status

Изменить статус. Только `AGENT` или `ADMIN`.

**Тело:**
```json
{ "status": "IN_PROGRESS" }
```

### PUT /api/tickets/:id/assign

Назначить агента. Только `AGENT` или `ADMIN`.

**Тело:**
```json
{ "assigneeId": "uuid-of-agent" }
```

### PUT /api/tickets/:id/priority

Изменить приоритет. Только `AGENT` или `ADMIN`.

**Тело:**
```json
{ "priority": "CRITICAL" }
```

### GET /api/tickets/:id/messages

Получить историю сообщений тикета.

### POST /api/tickets/:id/delegate

Создать запрос делегирования. Только `AGENT` или `ADMIN`. Только текущий assignee может инициировать.

**Тело:**
```json
{
  "toAgentId": "uuid-of-target-agent",
  "message": "Прошу принять тикет, ухожу в отпуск"
}
```

---

## Группа: Attachments (Вложения)

Все эндпоинты требуют аутентификации.

### POST /api/attachments

Загрузить файл. Multipart form-data, поле `file`. Максимальный размер — 50 МБ. Файл шифруется AES-256-GCM и сохраняется без расширения.

**Ответ:**
```json
{
  "data": {
    "id": "uuid",
    "originalName": "document.pdf",
    "mimeType": "application/pdf",
    "size": 102400
  }
}
```

### GET /api/attachments/:id

Получить метаданные вложения.

### GET /api/attachments/:id/download

Скачать расшифрованный файл. Заголовки `Content-Disposition` и `Content-Type` устанавливаются по оригинальному имени и MIME-типу.

### DELETE /api/attachments/:id

Удалить вложение. Файл удаляется с диска.

---

## Группа: Delegations (Делегирование)

Только `AGENT` и `ADMIN`.

### GET /api/delegations/incoming

Входящие запросы делегирования (по умолчанию только `PENDING`).

**Параметры:** `status` — фильтр по статусу (`PENDING`, `ACCEPTED`, `REJECTED`).

### GET /api/delegations/incoming/count

Количество входящих `PENDING` запросов.

**Ответ:**
```json
{ "data": { "count": 3 } }
```

### GET /api/delegations/outgoing

Исходящие запросы делегирования (последние 50).

### PUT /api/delegations/:id/respond

Ответить на запрос делегирования. Только целевой агент.

**Тело:**
```json
{ "accept": true }
```

- `true` — принять: тикет переназначается, создаётся новый псевдоним, все участники уведомляются
- `false` — отклонить: отправитель получает уведомление

---

## Группа: TopicGroups (Тематические группы)

### GET /api/topic-groups

Список всех групп. `AGENT` и `ADMIN`.

### GET /api/topic-groups/:id

Группа с тикетами. `AGENT` и `ADMIN`.

### PUT /api/topic-groups/:id

Обновить название группы. Только `ADMIN`.

**Тело:**
```json
{ "name": "Новое название группы" }
```

### DELETE /api/topic-groups/:id

Удалить группу. Только `ADMIN`.

### POST /api/topic-groups/:id/merge/:otherId

Объединить две группы. Только `ADMIN`. Тикеты из `otherId` переносятся в `:id`, `otherId` удаляется.

### POST /api/topic-groups/reclassify

Переклассифицировать все тикеты (сброс авто-групп и пересоздание). Только `ADMIN`. Операция выполняется фоново.

---

## Группа: Notifications (Уведомления)

Все эндпоинты требуют аутентификации.

### GET /api/notifications

Список уведомлений текущего пользователя.

### GET /api/notifications/count

Количество непрочитанных уведомлений.

**Ответ:**
```json
{ "data": { "count": 5 } }
```

### PUT /api/notifications/:id/read

Отметить уведомление прочитанным.

### PUT /api/notifications/read-all

Отметить все уведомления прочитанными.

---

## Группа: Push (Web Push уведомления)

Все эндпоинты требуют аутентификации.

### GET /api/push/vapid-key

Получить публичный VAPID-ключ для регистрации Service Worker.

**Ответ:**
```json
{ "data": { "vapidKey": "BG..." } }
```

### POST /api/push/subscribe

Подписать браузер на Web Push.

**Тело:**
```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
```

### DELETE /api/push/subscribe

Отписать браузер от Web Push.

---

## Группа: Admin (Администрирование)

Все эндпоинты требуют аутентификации. Большинство требует роли `ADMIN`.

### GET /api/admin/dashboard

Статистика и последние тикеты. Только `ADMIN`.

**Ответ:**
```json
{
  "data": {
    "stats": {
      "totalTickets": 150,
      "openTickets": 30,
      "inProgressTickets": 45,
      "resolvedTickets": 60,
      "totalUsers": 25,
      "totalAgents": 5,
      "totalGroups": 12
    },
    "recentTickets": [ ... ]
  }
}
```

### GET /api/admin/users

Список пользователей. `ADMIN` — все пользователи. `AGENT` — только агенты и админы (для списка делегирования).

**Параметры:** `page`, `limit`, `role`, `search`, `active`.

### POST /api/admin/users

Создать пользователя. Только `ADMIN`.

**Тело:**
```json
{
  "login": "agent1",
  "password": "pass12345",
  "displayName": "Агент Петров",
  "email": "agent@example.com",
  "role": "AGENT"
}
```

### PUT /api/admin/users/:id

Обновить имя и email пользователя. Только `ADMIN`.

### PUT /api/admin/users/:id/role

Изменить роль пользователя. Только `ADMIN`.

**Тело:**
```json
{ "role": "AGENT" }
```

### PUT /api/admin/users/:id/active

Активировать / деактивировать пользователя. Только `ADMIN`.

**Тело:**
```json
{ "isActive": false }
```

### DELETE /api/admin/users/:id

Деактивировать пользователя (soft delete — устанавливает `isActive: false`). Нельзя удалить корневого администратора (`isRootAdmin: true`). Только `ADMIN`.

### GET /api/admin/settings

Все настройки системы (ключ-значение). Только `ADMIN`.

### PUT /api/admin/settings/:key

Обновить настройку. Только `ADMIN`.

**Тело:**
```json
{ "value": "новое_значение" }
```

Примеры ключей: `registration.enabled`, `app.name`, `storage.maxFileSize`, `tickets.autoCloseAfterDays`, `grouping.similarityThreshold`.

### GET /api/admin/auth-providers

Список провайдеров авторизации. Только `ADMIN`.

### POST /api/admin/auth-providers

Создать провайдер. Только `ADMIN`.

**Тело (ONE_C):**
```json
{
  "type": "ONE_C",
  "name": "Вход через 1С",
  "config": {
    "baseUrl": "http://1c-server:8080",
    "authEndpoint": "/auth/validate",
    "timeout": 5000
  },
  "isActive": true
}
```

### PUT /api/admin/auth-providers/:id

Обновить провайдер. Только `ADMIN`.

### DELETE /api/admin/auth-providers/:id

Удалить провайдер. Только `ADMIN`.

### POST /api/admin/auth-providers/:id/test

Проверить доступность провайдера. Только `ADMIN`. Для `ONE_C` выполняет HEAD-запрос к `baseUrl + authEndpoint`.

---

## Swagger / OpenAPI

Интерактивная документация API доступна по адресу:

```
http://localhost:3000/api/docs
```

**Требования:**
- Роль `ADMIN`
- JWT в заголовке `Authorization: Bearer <token>`

Swagger UI отображает все задокументированные эндпоинты с примерами запросов и ответов. Спецификацию в формате JSON можно получить по адресу `GET /api/docs.json`.

---

## Health Check

```
GET /api/health
```

Публичный. Возвращает:
```json
{ "status": "ok", "timestamp": "2026-03-23T10:00:00.000Z" }
```

---

## WebSocket Protocol

### Подключение

```
ws://localhost:3000/ws?token=<JWT>&ticketId=<UUID>
```

При невалидном токене соединение закрывается с кодом `4001 Unauthorized`.

### Клиент → Сервер

**Отправить сообщение:**
```json
{
  "type": "message",
  "content": "Текст сообщения",
  "attachmentIds": ["uuid1", "uuid2"]
}
```

**Индикатор набора:**
```json
{ "type": "typing" }
```

### Сервер → Клиент

**История (сразу после подключения, последние 50 сообщений):**
```json
{
  "type": "history",
  "data": {
    "messages": [
      {
        "id": "uuid",
        "content": "Текст",
        "author": { "id": "uuid", "displayName": "Имя", "role": "USER" },
        "attachments": [],
        "createdAt": "2026-03-23T10:00:00.000Z"
      }
    ]
  }
}
```

**Новое сообщение (для USER — агент анонимизирован):**
```json
{
  "type": "message",
  "data": {
    "id": "uuid",
    "content": "Ваше обращение принято",
    "author": { "id": "agent", "displayName": "Ласковый Котёнок", "role": "AGENT" },
    "attachments": [],
    "createdAt": "2026-03-23T10:01:00.000Z"
  }
}
```

**Новое сообщение (для AGENT — реальные данные):**
```json
{
  "type": "message",
  "data": {
    "author": {
      "id": "real-uuid",
      "displayName": "Иван Иванов",
      "role": "AGENT",
      "alias": "Ласковый Котёнок"
    }
  }
}
```

**Индикатор набора:**
```json
{ "type": "typing", "data": { "displayName": "Ласковый Котёнок" } }
```

**Смена статуса:**
```json
{ "type": "status_changed", "data": { "status": "IN_PROGRESS" } }
```

**Смена агента (делегирование, для USER):**
```json
{ "type": "agent_changed", "data": { "newAgent": "Снежный Пингвин" } }
```

**Уведомление (персональный канал):**
```json
{
  "type": "notification",
  "data": {
    "id": "uuid",
    "type": "NEW_MESSAGE",
    "title": "Обращение #42",
    "body": "Ласковый Котёнок ответил на ваше обращение",
    "data": { "ticketId": "uuid" },
    "isRead": false,
    "createdAt": "2026-03-23T10:02:00.000Z"
  }
}
```

**Ошибка:**
```json
{ "type": "error", "data": { "code": "NOT_FOUND", "message": "Тикет не найден" } }
```
