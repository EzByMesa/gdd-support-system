# Фаза 2 — Мастер настройки бэкенда (Setup Wizard)

## Концепция

При первом запуске бэкенд определяет, что система не настроена (таблица `SetupState` не существует или `isComplete = false`).
Все запросы (кроме `/api/setup/*`) возвращают `503 Service Unavailable` с телом `{ setupRequired: true }`.
Frontend показывает пошаговый мастер настройки.

## Шаги мастера

### Шаг 1: Подключение к PostgreSQL
```
POST /api/setup/step/database
{
  "host": "localhost",
  "port": 5432,
  "database": "gdd_support",
  "username": "postgres",
  "password": "..."
}
```
- Бэкенд пробует подключиться к БД
- Если успешно — запускает миграции Sequelize (`sequelize.sync()`)
- Сохраняет строку подключения в `.env` файле
- Возвращает `{ success: true, step: "database" }`

### Шаг 2: Создание администратора
```
POST /api/setup/step/admin
{
  "login": "admin",
  "email": "admin@company.com",
  "password": "...",
  "displayName": "Администратор"
}
```
- Создает пользователя с ролью `ADMIN`
- Валидация: пароль >= 8 символов, login уникален
- Возвращает `{ success: true, step: "admin" }`

### Шаг 3: Настройка хранилища вложений
```
POST /api/setup/step/storage
{
  "path": "/var/gdd_support/attachments"
}
```
- Проверяет, что путь существует и доступен для записи
- Если не существует — пытается создать
- Генерирует мастер-ключ шифрования (AES-256)
- Сохраняет путь и ключ в `SystemSettings`
- Создаёт тестовый файл для проверки записи/чтения
- Возвращает `{ success: true, step: "storage" }`

### Шаг 4: Завершение
```
POST /api/setup/step/complete
```
- Устанавливает `SetupState.isComplete = true`
- Перезагружает конфигурацию сервера
- Возвращает JWT-токен администратора для автоматического входа

## Middleware: setupGuard

```typescript
// Все запросы кроме /api/setup/* проходят через этот middleware
async function setupGuard(req, res, next) {
  if (req.path.startsWith('/api/setup')) return next();

  const setup = await getSetupState();
  if (!setup || !setup.isComplete) {
    return res.status(503).json({
      error: 'SETUP_REQUIRED',
      message: 'System setup is not complete'
    });
  }
  next();
}
```

## Frontend: Setup Wizard UI

Простой пошаговый интерфейс:
- Прогресс-бар (4 шага)
- На каждом шаге — форма с полями
- Валидация на клиенте + ответ сервера
- Индикация успеха/ошибки

```
┌─────────────────────────────────────────────┐
│  GDD Support System — Первоначальная настройка │
│                                             │
│  [●]──[○]──[○]──[○]                        │
│   БД   Админ Хранилище Готово               │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ Подключение к PostgreSQL            │    │
│  │                                     │    │
│  │ Хост:    [localhost           ]     │    │
│  │ Порт:    [5432                ]     │    │
│  │ БД:      [gdd_support         ]     │    │
│  │ Логин:   [postgres            ]     │    │
│  │ Пароль:  [••••••••            ]     │    │
│  │                                     │    │
│  │ [Проверить подключение]  [Далее →]  │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## Безопасность

- После завершения настройки эндпоинты `/api/setup/*` отключаются
- Повторный запуск мастера возможен только через прямой доступ к БД (сброс `SetupState`)
- Пароли не логируются
- Мастер-ключ шифрования хранится в SystemSettings, зашифрованный через переменную окружения `APP_SECRET`
