# Дорожная карта реализации

## Порядок реализации

### Фаза 0: Инициализация проекта — DONE
- [x] Структура папок, package.json, Vite, Express, Sequelize
- [x] CSS дизайн-система (пастельный минимализм, mobile-first)
- [x] SPA-роутер с guard'ами ролей, два layout'а

### Фаза 1: Мастер настройки (Setup Wizard) — DONE
- [x] Backend: setupGuard, эндпоинты, 4 шага (БД/Админ/Хранилище/Готово)
- [x] Frontend: Stepper + формы, выбор PostgreSQL или SQLite

### Фаза 2: Аутентификация — DONE
- [x] JWT (access + refresh), Login, Register, 1С, управление регистрацией

### Фаза 3: Тикеты и вложения — DONE
- [x] CRUD, статусная машина, видимость по ролям, AES-256-GCM шифрование

### Фаза 4: Чат + Анонимные агенты — DONE
- [x] WebSocket, комнаты, анонимизация ("Ласковый Котёнок"), typing, REST fallback

### Фаза 5: Делегирование задач — DONE
- [x] Запрос → подтверждение → переназначение + новый псевдоним + уведомления

### Фаза 6: Группировка тикетов (Deep Learning) — DONE
- [x] @xenova/transformers, all-MiniLM-L6-v2, cosine similarity, автоклассификация

### Фаза 7: Push-уведомления — DONE
- [x] Web Push (VAPID) + WebSocket + БД, Service Worker, колокольчик

### Фаза 8: Админ-панель + SQLite — DONE
- [x] Dashboard, Users, Tickets, TopicGroups, Auth, Settings
- [x] SQLite как альтернатива PostgreSQL

### Фаза 9: Финализация — DONE
- [x] asyncHandler, глобальная обработка ошибок
- [x] Docker (Dockerfile, docker-compose, nginx)

---

## Статус: Все фазы завершены

### Возможные дальнейшие улучшения:
- [ ] Полировка мобильного UI (тестирование на реальных устройствах)
- [ ] Экспорт тикетов в CSV
- [ ] Аватарки пользователей
- [ ] Тёмная тема
- [ ] Email-уведомления (SMTP)
- [ ] Логирование действий (audit log)
- [ ] Rate limiting на API
- [ ] Автозакрытие resolved тикетов (cron)
