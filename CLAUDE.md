# GDD Support System

Система тикетов поддержки с чатом, анонимными агентами, ML-группировкой и push-уведомлениями.

## Стек

- **Backend:** Node.js, Express.js, Sequelize (PostgreSQL + SQLite), JavaScript (ES Modules)
- **Frontend:** Vanilla JS (без UI-библиотек), Vite, кастомная CSS дизайн-система
- **ML:** @xenova/transformers (all-MiniLM-L6-v2)
- **Realtime:** WebSocket (ws), Web Push (VAPID)
- **НЕ используем TypeScript** — только чистый JavaScript

## Структура

```
gdd_support_system/
├── backend/
│   └── src/
│       ├── app.js                 # Точка входа Express
│       ├── controllers/           # HTTP контроллеры
│       ├── middleware/            # auth, setupGuard, errorHandler
│       ├── models/                # Sequelize модели (12 моделей)
│       ├── routes/                # Express роуты
│       ├── services/              # Бизнес-логика (encryption, agentAlias, mlModel, topicGrouping, notification)
│       ├── setup/                 # Setup Wizard
│       ├── utils/                 # dbCompat (iLike)
│       └── websocket/             # WS сервер + chat handler
├── frontend/
│   └── src/
│       ├── main.js                # Точка входа + роуты
│       ├── components/            # UI компоненты (ui/, layout/, chat/, tickets/, notifications/)
│       ├── pages/                 # Страницы (+ admin/)
│       ├── services/              # api, auth, websocket, push, notifications
│       ├── router/                # SPA hash-роутер
│       ├── styles/                # CSS (variables, reset, base, components, layout, pages, admin, responsive)
│       └── utils/                 # dom, format, validate
└── .docs/todo/                    # Планы и архитектура
```

## Запуск

```bash
npm install                          # Установка зависимостей
npm run dev:backend                  # Backend на порту 3000
npm run dev:frontend                 # Frontend на порту 5173 (proxy к backend)
```

При первом запуске — Setup Wizard в браузере (выбор PostgreSQL или SQLite).

## Ключевые особенности

- **Анонимные агенты** — пользователь видит "Ласковый Котёнок" вместо реального имени агента
- **Делегирование** — с подтверждением + новый псевдоним
- **ML-группировка** — cosine similarity на embeddings, фоновая классификация
- **Шифрование вложений** — AES-256-GCM, файлы без расширений
- **SQLite поддержка** — для небольших инсталляций

## Текущий статус

Фазы 0-8 завершены. Осталась Фаза 9: финализация, адаптив, Docker.
