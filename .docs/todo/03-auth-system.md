# Фаза 3 — Аутентификация и авторизация

## Принцип: все токены ТОЛЬКО локальные

Независимо от способа входа (локальный, 1С, любой будущий провайдер) — система ВСЕГДА выдаёт собственный JWT. Никакие внешние токены не используются для доступа к API.

## JWT-стратегия
- **Access Token** — 15 мин, заголовок `Authorization: Bearer <token>`
- **Refresh Token** — 30 дней, HttpOnly cookie
- При истечении access token — автообновление через refresh

### Структура JWT payload
```json
{
  "sub": "user-uuid",
  "role": "ADMIN | AGENT | USER",
  "login": "username",
  "isRootAdmin": false,
  "iat": 1679000000,
  "exp": 1679000900
}
```

## API Эндпоинты

### Локальная авторизация
```
POST /api/auth/login
{ "login": "user", "password": "..." }
→ { accessToken, user: { id, login, displayName, role, isRootAdmin } }
  + Set-Cookie: refreshToken=... (HttpOnly, Secure, SameSite=Strict)

POST /api/auth/register    (если registration.enabled = true)
{ "login": "user", "email": "...", "password": "...", "displayName": "..." }
→ { accessToken, user: { ... } }
  Роль по умолчанию: USER (всегда)

POST /api/auth/refresh
Cookie: refreshToken=...
→ { accessToken }

POST /api/auth/logout
→ Очистка refresh cookie

GET /api/auth/me
→ { user: { id, login, displayName, role, isRootAdmin } }

GET /api/auth/providers
→ { providers: [{ type: "LOCAL", name: "..." }, { type: "ONE_C", name: "1С" }] }
  (Список активных провайдеров для отображения кнопок на странице входа)
```

### Авторизация через 1С

```
POST /api/auth/1c
{
  "login": "user_1c",
  "password": "pass_1c"
}
```

**Алгоритм:**
1. Бэкенд отправляет запрос к 1С HTTP-сервису (URL из AuthProvider.config)
2. 1С подтверждает пользователя и возвращает его данные
3. Поиск в локальной БД по `externalId` (ID из 1С) ИЛИ по `login`
4. **Если пользователь НЕ найден** → создаётся новая учётка:
   - `login` = логин из 1С
   - `displayName` = имя из 1С
   - `email` = email из 1С (если есть)
   - `role` = USER (всегда по умолчанию)
   - `authProvider` = ONE_C
   - `externalId` = id из 1С
   - `passwordHash` = null (вход только через 1С)
5. **Если пользователь найден** → обновляем `displayName` и `email` из 1С
6. Генерируем ЛОКАЛЬНЫЙ JWT (точно такой же, как при обычном входе)
7. Возвращаем `{ accessToken, user }` + refresh cookie

### Формат запроса к 1С
```
POST {1c_base_url}/auth/validate
Headers: { "Authorization": "Basic base64(login:password)" }
→ Response: {
    "success": true,
    "user": {
      "id": "1c-user-id",
      "name": "Иванов Иван",
      "email": "ivanov@company.com"
    }
  }
```

## Middleware авторизации

```javascript
// Проверка JWT — ЛОКАЛЬНОГО токена
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: { code: 'TOKEN_EXPIRED' } });
  }
}

// Проверка роли
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    }
    next();
  };
}

// Проверка: является ли пользователь админом (корневым или обычным)
function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: { code: 'FORBIDDEN' } });
  }
  next();
}
```

## Управление провайдерами авторизации (Админка)

```
GET    /api/admin/auth-providers          — список провайдеров
POST   /api/admin/auth-providers          — добавить провайдер
PUT    /api/admin/auth-providers/:id      — обновить
DELETE /api/admin/auth-providers/:id      — удалить
POST   /api/admin/auth-providers/:id/test — тест подключения к 1С
```

### Конфигурация провайдера 1С
```json
{
  "type": "ONE_C",
  "name": "1С:Предприятие",
  "config": {
    "baseUrl": "http://1c-server:8080/erp",
    "authEndpoint": "/auth/validate",
    "timeout": 5000,
    "defaultRole": "USER"
  },
  "isActive": true
}
```

## Управление регистрацией

```
PUT /api/admin/settings/registration
{ "enabled": false }
```

Когда регистрация отключена:
- `POST /api/auth/register` → `403 { error: "REGISTRATION_DISABLED" }`
- Новых пользователей может создавать только Администратор через админку
- Вход через 1С по-прежнему создаёт пользователей (это SSO, не регистрация)

## Корневой Администратор

- Создаётся при Setup Wizard (единственный пользователь с `isRootAdmin: true`)
- Может назначать **других Администраторов** (role = ADMIN)
- Обычные Администраторы тоже могут назначать других Администраторов (равные права)
- Роль по умолчанию при регистрации/входе через 1С: **USER**

## Матрица прав доступа

| Эндпоинт | ADMIN | AGENT | USER | Без авторизации |
|-----------|-------|-------|------|-----------------|
| POST /auth/login | + | + | + | + |
| POST /auth/register | + | + | + | + (если вкл) |
| POST /auth/1c | + | + | + | + |
| GET /tickets (все) | + | + (read-only чужие) | - | - |
| GET /tickets (свои) | + | + | + | - |
| POST /tickets | + | + | + | - |
| PUT /tickets/:id/assign (взять себе) | + | + (только свободные) | - | - |
| PUT /tickets/:id/status | + | + (только свои) | - | - |
| POST /tickets/:id/delegate | + | + (только свои) | - | - |
| GET /admin/* | + | - | - | - |
| POST /admin/* | + | - | - | - |
| WS /ws (чат) | + | + | + (свой тикет) | - |
