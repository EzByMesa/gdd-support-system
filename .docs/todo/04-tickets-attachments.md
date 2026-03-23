# Фаза 4 — Тикеты, вложения, видимость для агентов

## Видимость тикетов для агентов

**Ключевое правило: Любой агент видит ВСЕ тикеты. Но те, что взяты в работу другим агентом — только на чтение.**

### Логика доступа
- **USER** — видит только свои тикеты. Сразу видит список всех своих обращений после входа.
- **AGENT** — видит ВСЕ тикеты:
  - `OPEN` (свободные) — полный доступ, может взять в работу
  - Назначенные НА СЕБЯ — полный доступ (чат, статус, приоритет)
  - Назначенные НА ДРУГОГО агента — **только чтение** (видит содержимое, чат, статус, но не может ничего менять)
- **ADMIN** — видит все тикеты, полный доступ ко всем

### API: признак read-only

```
GET /api/tickets
→ {
  "data": [
    {
      "id": "uuid",
      "number": 42,
      "title": "...",
      "status": "IN_PROGRESS",
      "assignee": { "id": "...", "displayName": "..." },
      "readonly": false  // ← для агента: true если назначен на другого
    }
  ]
}
```

## API тикетов

### CRUD
```
POST   /api/tickets                — создать тикет
GET    /api/tickets                — список тикетов (с фильтрами)
GET    /api/tickets/:id            — детали тикета (+ readonly флаг)
PUT    /api/tickets/:id            — обновить тикет
PUT    /api/tickets/:id/status     — сменить статус
PUT    /api/tickets/:id/assign     — взять в работу (только OPEN)
PUT    /api/tickets/:id/priority   — сменить приоритет
POST   /api/tickets/:id/delegate   — делегировать (см. 12-delegation.md)
```

### Создание тикета
```
POST /api/tickets
Content-Type: multipart/form-data

{
  "title": "Не работает печать документов",
  "description": "При попытке печати из модуля 'Продажи' выдаёт ошибку...",
  "priority": "HIGH",
  "attachments": [File, File]
}

→ 201 {
  "data": {
    "id": "uuid",
    "number": 42,
    "title": "...",
    "status": "OPEN",
    "priority": "HIGH",
    "author": { "id", "displayName" },
    "attachments": [{ "id", "originalName", "size" }],
    "createdAt": "..."
  }
}
```

### Список тикетов (с пагинацией и фильтрами)
```
GET /api/tickets?page=1&limit=20&status=OPEN&priority=HIGH&search=печать&assignee=me&readonly=false

→ {
  "data": [...],
  "pagination": { "page": 1, "limit": 20, "total": 156, "totalPages": 8 }
}
```

### Взятие тикета в работу (агентом)
```
PUT /api/tickets/:id/assign
→ {
  "data": {
    ...ticket,
    "status": "IN_PROGRESS",
    "assignee": { "id", "displayName" },
    "agentAlias": "Ласковый Котёнок"  // анонимный псевдоним для пользователя
  }
}
```
- Можно взять только тикет со статусом `OPEN`
- Автоматически меняет статус на `IN_PROGRESS`
- Создаёт запись `AgentAlias` (анонимный псевдоним для этого тикета)
- Уведомление пользователю: "Вашим обращением занимается Ласковый Котёнок"

## Статусная машина тикета

```
                  ┌─────────────────┐
                  │                 │
   OPEN ──→ IN_PROGRESS ──→ WAITING_FOR_USER ──→ RESOLVED ──→ CLOSED
     │          │                    │                │
     │          └────────────────────┘                │
     │                                                │
     └────────────── CLOSED (admin) ──────────────────┘
```

Переходы:
- `OPEN → IN_PROGRESS` — агент берёт в работу
- `IN_PROGRESS → WAITING_FOR_USER` — ожидание ответа пользователя
- `WAITING_FOR_USER → IN_PROGRESS` — пользователь ответил (автоматически)
- `IN_PROGRESS → RESOLVED` — агент решил вопрос
- `RESOLVED → CLOSED` — пользователь подтвердил или автозакрытие (7 дней)
- `* → CLOSED` — администратор может закрыть из любого состояния

**Каждая смена статуса → push-уведомление пользователю.**

## Система вложений

### Загрузка
```
POST /api/attachments
Content-Type: multipart/form-data
{ "ticketId": "uuid", "file": File }
→ { "data": { "id": "uuid", "originalName": "screenshot.png", "size": 245760 } }
```

### Скачивание
```
GET /api/attachments/:id/download
→ Расшифровка на лету + Content-Disposition: attachment; filename="originalName"
```

### Шифрование AES-256-GCM

```
Загрузка:
1. Генерация случайного IV (16 байт)
2. Шифрование: AES-256-GCM(masterKey, IV, fileBuffer)
3. Сохранение: {storagePath}/{uuid}  (без расширения!)
4. В БД: originalName, storedName(uuid), mimeType, size, encryptionIV

Скачивание:
1. Чтение зашифрованного файла с диска
2. Расшифровка: AES-256-GCM-decrypt(masterKey, IV, encryptedBuffer)
3. Отдача с заголовками Content-Type + Content-Disposition
```

### Ограничения
- Макс. размер файла: 50 МБ (настраивается)
- Макс. вложений на тикет: 20
- Допустимые типы: изображения, PDF, документы, архивы (настраивается)

### Хранилище на диске
```
/var/gdd_support/attachments/
├── a1b2c3d4-e5f6-...    (зашифровано, без расширения)
├── f7g8h9i0-j1k2-...
└── ...
```
