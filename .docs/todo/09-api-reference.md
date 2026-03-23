# API Reference — Полная карта эндпоинтов

## Базовый URL
```
http://localhost:3000/api
```

## Аутентификация
Все защищённые эндпоинты требуют заголовок:
```
Authorization: Bearer <accessToken>
```
Токен — **всегда локальный JWT**, независимо от способа входа (LOCAL / 1C).

---

## Setup (Мастер настройки)
> Доступны только когда система НЕ настроена

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/setup/status` | Статус настройки |
| POST | `/setup/step/database` | Подключение к БД |
| POST | `/setup/step/admin` | Создание корневого администратора |
| POST | `/setup/step/storage` | Настройка хранилища |
| POST | `/setup/step/complete` | Завершение настройки |

## Auth (Аутентификация)

| Метод | Путь | Описание | Роли |
|-------|------|----------|------|
| POST | `/auth/login` | Вход (локальный) | * |
| POST | `/auth/register` | Регистрация (если вкл), роль=USER | * |
| POST | `/auth/1c` | Вход через 1С (создаёт учётку если нет, локальный JWT) | * |
| POST | `/auth/refresh` | Обновление access token | * |
| POST | `/auth/logout` | Выход | auth |
| GET | `/auth/me` | Текущий пользователь | auth |
| GET | `/auth/providers` | Список активных провайдеров (для UI входа) | * |

## Tickets (Тикеты)

| Метод | Путь | Описание | Роли |
|-------|------|----------|------|
| POST | `/tickets` | Создать тикет | auth |
| GET | `/tickets` | Список тикетов (+ readonly флаг для агентов) | auth |
| GET | `/tickets/:id` | Детали тикета | auth |
| PUT | `/tickets/:id` | Обновить тикет | author/admin |
| PUT | `/tickets/:id/status` | Сменить статус | assignee/admin |
| PUT | `/tickets/:id/assign` | Взять в работу (только OPEN) | agent/admin |
| PUT | `/tickets/:id/priority` | Сменить приоритет | assignee/admin |

Видимость для AGENT: все тикеты видны, но чужие в работе — `readonly: true`.

## Delegation (Делегирование)

| Метод | Путь | Описание | Роли |
|-------|------|----------|------|
| POST | `/tickets/:id/delegate` | Создать запрос делегирования | assignee |
| GET | `/delegations/incoming` | Входящие запросы (pending) | agent/admin |
| GET | `/delegations/outgoing` | Исходящие запросы | agent/admin |
| PUT | `/delegations/:id/respond` | Принять/отклонить | target agent |

## Messages (Сообщения тикета)

| Метод | Путь | Описание | Роли |
|-------|------|----------|------|
| GET | `/tickets/:id/messages` | Список (анонимизированы для USER) | участник |
| POST | `/tickets/:id/messages` | Отправить сообщение | участник |

## Attachments (Вложения)

| Метод | Путь | Описание | Роли |
|-------|------|----------|------|
| POST | `/attachments` | Загрузить файл | auth |
| GET | `/attachments/:id` | Метаданные | auth |
| GET | `/attachments/:id/download` | Скачать (расшифровка на лету) | auth |
| DELETE | `/attachments/:id` | Удалить | author/admin |

## Topic Groups (Тематические группы)

| Метод | Путь | Описание | Роли |
|-------|------|----------|------|
| GET | `/topic-groups` | Список групп | agent/admin |
| GET | `/topic-groups/:id` | Детали группы | agent/admin |
| PUT | `/topic-groups/:id` | Обновить | admin |
| DELETE | `/topic-groups/:id` | Удалить | admin |
| POST | `/topic-groups/:id/merge/:otherId` | Объединить | admin |
| POST | `/topic-groups/reclassify` | Перегруппировка | admin |

## Notifications (Уведомления)

| Метод | Путь | Описание | Роли |
|-------|------|----------|------|
| GET | `/notifications` | Список уведомлений | auth |
| GET | `/notifications/count` | Количество непрочитанных | auth |
| PUT | `/notifications/:id/read` | Пометить прочитанным | auth |
| PUT | `/notifications/read-all` | Пометить все прочитанными | auth |

## Push (Web Push подписка)

| Метод | Путь | Описание | Роли |
|-------|------|----------|------|
| GET | `/push/vapid-key` | Публичный VAPID-ключ | auth |
| POST | `/push/subscribe` | Подписаться на push | auth |
| DELETE | `/push/subscribe` | Отписаться | auth |

## Admin — Users

| Метод | Путь | Описание | Роли |
|-------|------|----------|------|
| GET | `/admin/users` | Список пользователей | admin |
| POST | `/admin/users` | Создать пользователя | admin |
| GET | `/admin/users/:id` | Детали пользователя | admin |
| PUT | `/admin/users/:id` | Обновить | admin |
| PUT | `/admin/users/:id/role` | Сменить роль (USER/AGENT/ADMIN) | admin |
| PUT | `/admin/users/:id/active` | Вкл/выкл | admin |
| DELETE | `/admin/users/:id` | Удалить (soft) | admin |

## Admin — Auth Providers

| Метод | Путь | Описание | Роли |
|-------|------|----------|------|
| GET | `/admin/auth-providers` | Список провайдеров | admin |
| POST | `/admin/auth-providers` | Добавить | admin |
| PUT | `/admin/auth-providers/:id` | Обновить | admin |
| DELETE | `/admin/auth-providers/:id` | Удалить | admin |
| POST | `/admin/auth-providers/:id/test` | Тест подключения | admin |

## Admin — Settings

| Метод | Путь | Описание | Роли |
|-------|------|----------|------|
| GET | `/admin/settings` | Все настройки | admin |
| PUT | `/admin/settings/:key` | Обновить настройку | admin |

## WebSocket

```
WS /ws?token=<JWT>                    — подписка на уведомления (глобально)
WS /ws?token=<JWT>&ticketId=<UUID>    — подключение к чату тикета
```

Сервер автоматически анонимизирует имена агентов для USER.

---

## Формат ответов

### Успех
```json
{ "data": { ... } }
```

### Список с пагинацией
```json
{
  "data": [...],
  "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

### Ошибка
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Поле title обязательно",
    "details": { "field": "title" }
  }
}
```

### Коды ошибок
| HTTP | Код | Описание |
|------|-----|----------|
| 400 | VALIDATION_ERROR | Ошибка валидации |
| 401 | UNAUTHORIZED | Не авторизован |
| 401 | TOKEN_EXPIRED | Токен истёк |
| 403 | FORBIDDEN | Нет прав |
| 403 | REGISTRATION_DISABLED | Регистрация отключена |
| 403 | TICKET_READONLY | Тикет только для чтения (для агента) |
| 404 | NOT_FOUND | Не найдено |
| 409 | DELEGATION_PENDING | Уже есть активный запрос на делегирование |
| 503 | SETUP_REQUIRED | Требуется настройка |
