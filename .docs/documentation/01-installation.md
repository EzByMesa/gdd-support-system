# 01. Установка и запуск

## Требования

| Компонент | Версия |
|-----------|--------|
| Node.js | 20 и выше |
| npm | 9 и выше (входит в Node.js 20) |
| База данных | PostgreSQL 14+ **или** SQLite (без дополнительных зависимостей) |
| Docker | 24+ (опционально, для контейнерного запуска) |

---

## Установка зависимостей

Проект использует npm workspaces. Одна команда устанавливает зависимости для корневого пакета, backend и frontend:

```bash
cd gdd_support_system
npm install
```

---

## Запуск в режиме разработки

### Backend

```bash
npm run dev:backend
```

Сервер запускается на `http://localhost:3000`.

### Frontend

```bash
npm run dev:frontend
```

Vite-сервер запускается на `http://localhost:5173` с проксированием `/api` и `/ws` к backend.

### Оба сервиса одновременно

```bash
npm run dev
```

---

## Первоначальная настройка — Setup Wizard

При первом запуске база данных не настроена. Система автоматически перенаправляет браузер на страницу `/setup`, где нужно пройти 4 шага:

### Шаг 1 — База данных

Выберите тип СУБД:

**PostgreSQL:**
- Хост (например, `localhost`)
- Порт (по умолчанию `5432`)
- Имя базы данных
- Имя пользователя
- Пароль

**SQLite** (для небольших инсталляций):
- Путь к файлу базы данных, например `/app/data/database.sqlite`

После успешного подключения система создаёт все таблицы (Sequelize `sync`) и записывает `DATABASE_URL` и `DB_DIALECT` в файл `backend/.env`.

### Шаг 2 — Администратор

Создаётся корневой администратор (`isRootAdmin: true`). Поля:
- Логин (минимум 3 символа, только латиница, цифры, `_`, `.`, `-`)
- Пароль (минимум 8 символов)
- Отображаемое имя
- Email (опционально)

### Шаг 3 — Хранилище вложений

Укажите путь к директории для хранения файлов. Если директория не существует, она создаётся автоматически. Система генерирует мастер-ключ шифрования AES-256 и сохраняет его в таблице `SystemSettings`.

### Шаг 4 — Завершение

Система записывает настройки по умолчанию:

| Ключ | Значение по умолчанию |
|------|-----------------------|
| `registration.enabled` | `true` |
| `app.name` | `GDD Support System` |
| `storage.maxFileSize` | `52428800` (50 МБ) |
| `tickets.autoCloseAfterDays` | `7` |
| `grouping.similarityThreshold` | `0.75` |

После завершения wizard автоматически выполняет вход от имени корневого администратора.

---

## Переменные окружения

Файл `backend/.env` (создаётся автоматически в процессе Setup Wizard, но может быть задан вручную до запуска):

```dotenv
# Порт HTTP-сервера (по умолчанию 3000)
PORT=3000

# Секрет для подписи JWT-токенов — ОБЯЗАТЕЛЬНО сменить в production
JWT_SECRET=change-me-in-production

# Окружение (development / production)
NODE_ENV=development

# URL фронтенда для CORS (по умолчанию http://localhost:5173)
FRONTEND_URL=http://localhost:5173

# Строка подключения к БД (заполняется Setup Wizard)
# PostgreSQL:
DATABASE_URL=postgres://user:password@localhost:5432/gdd_support
DB_DIALECT=postgres

# SQLite:
# DATABASE_URL=/app/data/database.sqlite
# DB_DIALECT=sqlite
```

---

## Запуск через Docker Compose

Проект поставляется с готовым `docker-compose.yml`.

### Структура сервисов

| Сервис | Образ | Порт |
|--------|-------|------|
| `postgres` | postgres:16-alpine | 5432 |
| `backend` | ./backend (Dockerfile) | 3000 |
| `frontend` | ./frontend (Dockerfile + Nginx) | 80 |

### Быстрый старт

```bash
# Из корня проекта
docker-compose up -d
```

Frontend будет доступен по адресу `http://localhost:80`.

### Запуск с PostgreSQL

В `docker-compose.yml` раскомментируйте переменные окружения backend:

```yaml
environment:
  DATABASE_URL: postgres://gdd:gdd_password@postgres:5432/gdd_support
  DB_DIALECT: postgres
  JWT_SECRET: your-strong-secret-here
  NODE_ENV: production
```

После запуска откройте браузер и пройдите Setup Wizard (шаги 2–4 — БД уже настроена через переменные окружения).

### Запуск с SQLite

Не задавайте `DATABASE_URL` в `docker-compose.yml`. Setup Wizard выполнит подключение к SQLite при первом открытии браузера.

### Постоянное хранение данных

Docker Compose создаёт именованные тома:

| Том | Назначение |
|-----|-----------|
| `pgdata` | Данные PostgreSQL |
| `attachments` | Зашифрованные файлы вложений |
| `backend_data` | SQLite-файл и прочие данные backend |

---

## Проверка работоспособности

```bash
# Health-check API
curl http://localhost:3000/api/health
# Ожидаемый ответ: {"status":"ok","timestamp":"..."}
```
