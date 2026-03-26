# GDD Служба поддержки

Система тикетов поддержки с чатом, анонимными агентами, ML-группировкой, push-уведомлениями и регистрацией через провайдер СервисДеск (1С).

## Стек

- **Backend:** Node.js, Express.js, Sequelize (PostgreSQL + SQLite), JavaScript (ES Modules)
- **Frontend:** Vue 3 + Vuetify 3 + Pinia, Vite
- **ML:** @xenova/transformers (all-MiniLM-L6-v2)
- **Realtime:** WebSocket (ws), Web Push (VAPID)
- **НЕ используем TypeScript** — только чистый JavaScript

## Структура

```
gdd_support_system/
├── backend/
│   └── src/
│       ├── app.js                 # Точка входа Express + миграции SQLite
│       ├── controllers/           # HTTP контроллеры (auth, authOneC, ticket, delegation, notification)
│       ├── middleware/            # auth, setupGuard, errorHandler
│       ├── models/                # Sequelize модели (15 моделей)
│       ├── routes/                # Express роуты (7 модулей)
│       ├── services/              # Бизнес-логика (encryption, agentAlias, mlModel, topicGrouping, notification, email)
│       ├── setup/                 # Setup Wizard
│       ├── utils/                 # dbCompat (iLike), asyncHandler
│       └── websocket/             # WS сервер + chat handler
├── frontend/
│   └── src/
│       ├── main.js                # Точка входа + Vue Router
│       ├── config.js              # Конфигурация (backendUrl, apiUrl, wsUrl)
│       ├── components/
│       │   ├── ui/                # RoleAvatar, AppButton, AppInput, AppModal и др.
│       │   ├── layout/            # MainLayout, AdminLayout, AppHeader
│       │   ├── chat/              # ChatWindow (realtime WS)
│       │   ├── tickets/           # TicketCard, DelegateModal
│       │   └── notifications/     # NotificationDropdown
│       ├── pages/                 # 10 пользовательских страниц
│       │   └── admin/             # 7 админских страниц
│       ├── stores/                # Pinia: auth, notifications
│       ├── services/              # api (HTTP), websocket (WS), push (Web Push)
│       ├── composables/           # useToast
│       ├── plugins/               # vuetify
│       ├── styles/                # CSS (app.css, pages.css)
│       └── utils/                 # dom, format, validate
└── data/                          # Runtime данные
    └── avatars/                   # Аватарки пользователей
```

## Запуск

```bash
npm install                          # Установка зависимостей
npm run dev:backend                  # Backend на порту 3000
npm run dev:frontend                 # Frontend на порту 5173 (proxy к backend)
```

При первом запуске — Setup Wizard в браузере (выбор PostgreSQL или SQLite).

## Ключевые особенности

- **Анонимные агенты** — пользователь видит "Ласковый Котёнок" вместо реального имени агента. Подмена в: listTickets, getTicket (бэкенд), chatHandler (WS). AGENT/ADMIN видят реальные имена + alias.
- **Системные сообщения** — при assign/status/close в чат добавляется стилизованное событийное сообщение (isSystem=true в TicketMessage)
- **Делегирование** — запрос → подтверждение целевым агентом → новый псевдоним
- **ML-группировка** — cosine similarity на embeddings, фоновая классификация при создании тикета
- **Шифрование вложений** — AES-256-GCM, файлы без расширений
- **Провайдер СервисДеск** — регистрация через 1С: получаем профиль, создаём учётку с теми же логин/пароль. Вход — обычный локальный.
- **Уведомления** — умная маршрутизация: online → WS+toast, offline → push/email. Типы: NEW_TICKET, NEW_MESSAGE, STATUS_CHANGED, TICKET_ASSIGNED, DELEGATION_*
- **Создание от имени** — AGENT/ADMIN создают тикеты от имени пользователей (onBehalfOfUserId → authorId + createdById). Чип "Создано администратором".
- **Аватарки** — загрузка в профиле (POST /api/profile/avatar, 2MB, disk storage). RoleAvatar — корона (ADMIN), наушники (AGENT).
- **Прочитанность** — TicketReadStatus (lastReadAt per user+ticket). Auto-mark при входе в чат и при live-получении сообщений. Badge непрочитанных на карточке тикета.
- **Полное WS-покрытие** — все мутации тикетов (create, assign, status, priority, close, delegate) отправляют `tickets_updated` всем участникам. Profile/avatar обновления → `profile_updated`. Деактивация → `force_logout`.
- **Группировка тикетов** — для AGENT/ADMIN список разделён на "Мои тикеты" / "Остальные" с именем заявителя.
- **Поиск и фильтры** — строка поиска + селекты статуса/приоритета вместо табов.
- **Rate limiting** — express-rate-limit: 300 req/15min общий, 20 req/15min для auth.

## Роуты API

| Модуль | Prefix | Ключевые эндпоинты |
|--------|--------|---------------------|
| auth | /api/auth | login, register, register/1c, 1c/profile, refresh, logout, me, providers |
| tickets | /api/tickets | CRUD, status, assign, close, delegate, messages, custom-fields |
| attachments | /api/attachments | upload, download, delete (AES-256-GCM) |
| notifications | /api/notifications | list, count, read, delete, /push/* |
| profile | /api/profile | get/update, password, email verify, avatar, notification-preferences |
| delegations | /api/delegations | incoming, outgoing, respond |
| admin | /api/admin | dashboard, users, settings, auth-providers, tickets (delete), smtp, custom-fields |
| topic-groups | /api/topic-groups | list, update, delete, merge, reclassify |

## WebSocket события

| Тип | Направление | Описание |
|-----|-------------|----------|
| message | server→client | Новое сообщение в чате (анонимизировано для USER) |
| history | server→client | 50 последних сообщений при подключении |
| typing | bidirectional | Индикатор набора (анонимизировано для USER) |
| status_changed | server→client | Смена статуса тикета |
| ticket_updated | server→client | Тикет обновлён (assign и др.) |
| tickets_updated | server→client | Список тикетов изменился (для автообновления) |
| notification | server→client | Уведомление (через personal channel) |
| profile_updated | server→client | Профиль/аватарка обновлены |
| force_logout | server→client | Учётная запись деактивирована |

## Модели (16)

User, Ticket, TicketMessage, TicketReadStatus, Attachment, AgentAlias, TopicGroup, DelegationRequest, Notification, NotificationPreference, PushSubscription, CustomField, AuthProvider, EmailVerification, SystemSettings, SetupState

## SQLite миграции

В `app.js` → `safeAddColumn()` для полей: closedReason, customFields, verifiedEmail, isSystem, createdById, avatarPath.
PostgreSQL использует `sync({ alter: true })`.

## Важные правила

- Анонимизация агентов: для USER все имена агентов заменяются на alias. `id` агента заменяется на 'agent'. Никогда не раскрывать реальные данные агентов пользователям.
- Notification store: `init()` вызывает `destroy()` перед созданием нового WS (защита от утечки между сессиями). `logout()` обязательно вызывает `notifStore.destroy()`.
- ChatWindow: `readonly` prop реактивен в обе стороны (lock/unlock при изменении доступа).
- `config.js` — единая точка для backendUrl, apiUrl, wsUrl. Все fetch/href используют config.
