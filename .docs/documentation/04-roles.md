# 04. Роли и права доступа

## Роли пользователей

Система поддерживает три роли. Роль хранится в поле `role` таблицы `users` и включается в JWT-payload.

| Роль | Константа | Описание |
|------|-----------|----------|
| Пользователь | `USER` | Клиент поддержки — создаёт обращения, общается с агентом |
| Агент | `AGENT` | Сотрудник поддержки — обрабатывает обращения |
| Администратор | `ADMIN` | Полный доступ — управляет системой и пользователями |

---

## Роль: USER (Пользователь)

### Что может

- Создавать обращения (тикеты)
- Просматривать **только свои** тикеты
- Читать историю сообщений своих тикетов
- Отправлять сообщения в чате своих тикетов
- Прикреплять файлы к сообщениям
- Просматривать и скачивать вложения своих тикетов
- Получать уведомления (колокольчик + Web Push)
- Управлять своими push-подписками

### Что не может

- Видеть чужие тикеты
- Видеть реальное имя агента (только псевдоним "Прилагательное + Животное")
- Изменять статус или приоритет тикета
- Назначать агентов
- Делегировать тикеты
- Видеть тематические группы
- Заходить в /admin

### Особенности

- При самостоятельной регистрации всегда создаётся с ролью `USER`
- Агент может создать пользователя с любой ролью через `/admin/users`
- Если пользователь отвечает на тикет в статусе `WAITING_FOR_USER`, статус автоматически меняется на `IN_PROGRESS`

---

## Роль: AGENT (Агент)

### Что может

- Видеть **все** тикеты в системе
- Видеть реальные имена пользователей и других агентов
- Видеть своё отображение для пользователя (псевдоним)
- Взять тикет в работу (`PUT /api/tickets/:id/assign`)
- Менять статус тикетов, которые назначены на него
- Менять приоритет тикетов
- Отправлять сообщения в чат **только назначенных на него** тикетов
- Прикреплять файлы
- Инициировать делегирование (только своих тикетов)
- Принимать/отклонять входящие запросы делегирования
- Видеть список тематических групп
- Получать уведомления
- Видеть список агентов/администраторов (`GET /api/admin/users`) для выбора при делегировании

### Тикеты в readonly-режиме

Агент видит все тикеты, но не назначенные на него помечены флагом `readonly: true`. В интерфейсе они отображаются с бейджем "Только чтение". Отправлять сообщения в такие тикеты нельзя.

### Что не может

- Заходить в /admin (кроме `/api/admin/users` в ограниченном режиме)
- Управлять пользователями
- Изменять системные настройки
- Удалять или переименовывать тематические группы

---

## Роль: ADMIN (Администратор)

### Что может (дополнительно к AGENT)

- Доступ к панели администратора (`/admin`)
- Просмотр дашборда со статистикой
- Полное управление пользователями: создание, редактирование, смена роли, активация/деактивация, удаление
- Управление настройками системы (`SystemSettings`)
- Управление провайдерами авторизации
- Управление тематическими группами: переименование, удаление, объединение, переклассификация
- Просмотр всех тикетов в `/admin/tickets`
- Доступ к Swagger UI (`/api/docs`)
- Инициировать делегирование для **любого** тикета (не только своего)
- Отправлять сообщения в чат **любого** тикета

### Корневой администратор (`isRootAdmin`)

Создаётся только в процессе Setup Wizard (шаг 2). Особенности:

- `isRootAdmin: true` в записи базы данных
- Флаг включается в JWT payload
- **Нельзя удалить** — `DELETE /api/admin/users/:id` возвращает `403 FORBIDDEN` если `user.isRootAdmin === true`
- Нельзя деактивировать через обычный интерфейс
- Единственная защита от полной потери доступа к системе

---

## Матрица доступа по эндпоинтам

### Auth

| Эндпоинт | Публичный | USER | AGENT | ADMIN |
|----------|-----------|------|-------|-------|
| POST /api/auth/login | + | + | + | + |
| POST /api/auth/register | + | — | — | — |
| POST /api/auth/1c | + | — | — | — |
| POST /api/auth/refresh | + | + | + | + |
| GET /api/auth/providers | + | + | + | + |
| POST /api/auth/logout | — | + | + | + |
| GET /api/auth/me | — | + | + | + |

### Tickets

| Эндпоинт | USER | AGENT | ADMIN | Примечания |
|----------|------|-------|-------|------------|
| POST /api/tickets | + | + | + | |
| GET /api/tickets | только свои | все | все | |
| GET /api/tickets/:id | только свой | + | + | |
| PUT /api/tickets/:id | только свой | + | + | |
| PUT /api/tickets/:id/status | — | + | + | |
| PUT /api/tickets/:id/assign | — | + | + | |
| PUT /api/tickets/:id/priority | — | + | + | |
| GET /api/tickets/:id/messages | только свой | + | + | |
| POST /api/tickets/:id/delegate | — | только assignee | + | |

### Attachments

| Эндпоинт | USER | AGENT | ADMIN |
|----------|------|-------|-------|
| POST /api/attachments | + | + | + |
| GET /api/attachments/:id | своего тикета | + | + |
| GET /api/attachments/:id/download | своего тикета | + | + |
| DELETE /api/attachments/:id | своё | + | + |

### Delegations

| Эндпоинт | USER | AGENT | ADMIN |
|----------|------|-------|-------|
| GET /api/delegations/incoming | — | + | + |
| GET /api/delegations/incoming/count | — | + | + |
| GET /api/delegations/outgoing | — | + | + |
| PUT /api/delegations/:id/respond | — | только toAgent | + |

### Topic Groups

| Эндпоинт | USER | AGENT | ADMIN |
|----------|------|-------|-------|
| GET /api/topic-groups | — | + | + |
| GET /api/topic-groups/:id | — | + | + |
| PUT /api/topic-groups/:id | — | — | + |
| DELETE /api/topic-groups/:id | — | — | + |
| POST /api/topic-groups/:id/merge/:otherId | — | — | + |
| POST /api/topic-groups/reclassify | — | — | + |

### Notifications / Push

| Эндпоинт | USER | AGENT | ADMIN |
|----------|------|-------|-------|
| GET /api/notifications | + | + | + |
| GET /api/notifications/count | + | + | + |
| PUT /api/notifications/:id/read | + | + | + |
| PUT /api/notifications/read-all | + | + | + |
| GET /api/push/vapid-key | + | + | + |
| POST /api/push/subscribe | + | + | + |
| DELETE /api/push/subscribe | + | + | + |

### Admin

| Эндпоинт | USER | AGENT | ADMIN |
|----------|------|-------|-------|
| GET /api/admin/dashboard | — | — | + |
| GET /api/admin/users | — | + (только агенты) | + (все) |
| POST /api/admin/users | — | — | + |
| PUT /api/admin/users/:id | — | — | + |
| PUT /api/admin/users/:id/role | — | — | + |
| PUT /api/admin/users/:id/active | — | — | + |
| DELETE /api/admin/users/:id | — | — | + |
| GET /api/admin/settings | — | — | + |
| PUT /api/admin/settings/:key | — | — | + |
| GET /api/admin/auth-providers | — | — | + |
| POST /api/admin/auth-providers | — | — | + |
| PUT /api/admin/auth-providers/:id | — | — | + |
| DELETE /api/admin/auth-providers/:id | — | — | + |
| POST /api/admin/auth-providers/:id/test | — | — | + |
| GET /api/docs | — | — | + |

---

## Реализация проверки прав

Права проверяются на уровне middleware:

```
authenticate     — проверяет JWT (Bearer), устанавливает req.user
authorize(roles) — проверяет req.user.role ∈ roles
requireAdmin     — проверяет req.user.role === 'ADMIN'
```

Дополнительная бизнес-логика в контроллерах:
- `ticketController.listTickets` — для USER добавляет `WHERE authorId = req.user.sub`
- `ticketController.assignTicket` — проверяет принадлежность тикета (только AGENT/ADMIN)
- `chatHandler.handleChatMessage` — USER не может писать в чужой тикет; AGENT не может писать в тикет, не назначенный на него
- `delegationController.createDelegation` — только текущий assignee может делегировать (кроме ADMIN)
- `delegationController.respondDelegation` — только `toAgentId` может отвечать
