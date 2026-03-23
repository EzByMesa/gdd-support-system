# Архитектура фронтенда

## Принципы
- Чистый JavaScript (ES Modules), без TypeScript
- Никаких UI-фреймворков и библиотек
- Кастомная компонентная система на классах
- Кастомная CSS дизайн-система: **пастельные оттенки, минимализм**
- Vite как сборщик
- **Mobile-first** адаптивный дизайн (все экраны, включая админку)

## Визуальный стиль

**Современный минимализм с пастельными оттенками:**
- Мягкие, приглушённые цвета — никаких кричащих оттенков
- Много белого пространства
- Скруглённые углы
- Лёгкие тени вместо бордеров
- Чёткая иерархия: пользователь сразу видит важное

## SPA-роутер

```javascript
// router/index.js
class Router {
  constructor() {
    this.routes = new Map();
    this.guards = [];  // middleware для проверки ролей
    window.addEventListener('hashchange', () => this.resolve());
  }

  route(path, handler, options = {}) {
    this.routes.set(path, { handler, ...options });
    return this;
  }

  // Guard: проверка роли перед рендером
  guard(fn) {
    this.guards.push(fn);
    return this;
  }

  navigate(path) {
    window.location.hash = path;
  }

  resolve() {
    const hash = window.location.hash.slice(1) || '/';

    for (const [pattern, route] of this.routes) {
      const params = matchRoute(pattern, hash);
      if (params !== null) {
        // Проверка guards (роли, авторизация)
        if (route.roles && !this.checkRole(route.roles)) {
          this.navigate('/');
          return;
        }
        route.handler(params);
        return;
      }
    }
    this.notFound();
  }
}
```

### Карта маршрутов

```javascript
// Единый URL для всех ролей
router
  // Public
  .route('/login', LoginPage)
  .route('/register', RegisterPage)
  .route('/setup', SetupWizardPage)

  // User / Agent (основной интерфейс)
  .route('/', TicketsPage, { roles: ['USER', 'AGENT', 'ADMIN'] })
  .route('/tickets/new', NewTicketPage, { roles: ['USER', 'AGENT', 'ADMIN'] })
  .route('/tickets/:id', TicketDetailPage, { roles: ['USER', 'AGENT', 'ADMIN'] })

  // Admin (отдельный крупный роут)
  .route('/admin', AdminDashboardPage, { roles: ['ADMIN'] })
  .route('/admin/dashboard', AdminDashboardPage, { roles: ['ADMIN'] })
  .route('/admin/users', AdminUsersPage, { roles: ['ADMIN'] })
  .route('/admin/users/:id', AdminUserDetailPage, { roles: ['ADMIN'] })
  .route('/admin/tickets', AdminTicketsPage, { roles: ['ADMIN'] })
  .route('/admin/tickets/:id', AdminTicketDetailPage, { roles: ['ADMIN'] })
  .route('/admin/topic-groups', AdminTopicGroupsPage, { roles: ['ADMIN'] })
  .route('/admin/auth', AdminAuthPage, { roles: ['ADMIN'] })
  .route('/admin/settings', AdminSettingsPage, { roles: ['ADMIN'] });
```

## Два Layout'a

### MainLayout (для User/Agent)
```
Desktop:
┌──────────────────────────────────────────────┐
│  [GDD Support]  🔔 2  👤 Имя       [Выход]  │
├──────────────────────────────────────────────┤
│  Content Area                                │
│  (Сразу видны все обращения)                 │
└──────────────────────────────────────────────┘

Mobile:
┌──────────────────────────┐
│  [GDD]  🔔  👤  [Выход]  │
├──────────────────────────┤
│  Content (full width)    │
└──────────────────────────┘
```

### AdminLayout (для Admin)
```
Отдельный layout с sidebar — см. 07-admin-panel.md
```

## Структура файлов

```
src/
├── components/
│   ├── ui/                       # Базовые UI-компоненты
│   │   ├── Button.js
│   │   ├── Input.js
│   │   ├── TextArea.js
│   │   ├── Select.js
│   │   ├── Modal.js
│   │   ├── BottomSheet.js        # Модалка для мобильных
│   │   ├── Table.js
│   │   ├── CardList.js           # Мобильная альтернатива таблице
│   │   ├── Pagination.js
│   │   ├── FileUpload.js
│   │   ├── Toast.js
│   │   ├── Tabs.js
│   │   ├── Badge.js
│   │   ├── Dropdown.js
│   │   ├── Stepper.js
│   │   ├── Spinner.js
│   │   ├── EmptyState.js
│   │   └── NotificationBell.js   # Колокольчик уведомлений
│   ├── layout/
│   │   ├── MainLayout.js         # Layout для User/Agent
│   │   ├── AdminLayout.js        # Layout для Admin (с sidebar)
│   │   ├── Header.js
│   │   ├── AdminSidebar.js
│   │   └── MobileDrawer.js       # Slide-in menu для мобильных
│   ├── tickets/
│   │   ├── TicketCard.js
│   │   ├── TicketList.js
│   │   ├── TicketForm.js
│   │   ├── TicketDetail.js
│   │   ├── TicketFilters.js
│   │   ├── TicketStatusBadge.js
│   │   └── DelegateModal.js      # Модалка делегирования
│   ├── chat/
│   │   ├── ChatWindow.js
│   │   ├── ChatMessage.js
│   │   └── ChatInput.js
│   └── notifications/
│       ├── NotificationList.js
│       └── NotificationItem.js
├── pages/
│   ├── LoginPage.js
│   ├── RegisterPage.js
│   ├── SetupWizardPage.js
│   ├── TicketsPage.js            # Главная: список обращений
│   ├── TicketDetailPage.js       # Детали + чат
│   ├── NewTicketPage.js
│   └── admin/
│       ├── AdminDashboardPage.js
│       ├── AdminUsersPage.js
│       ├── AdminUserDetailPage.js
│       ├── AdminTicketsPage.js
│       ├── AdminTicketDetailPage.js
│       ├── AdminTopicGroupsPage.js
│       ├── AdminAuthPage.js
│       └── AdminSettingsPage.js
├── services/
│   ├── api.js                    # HTTP-клиент (fetch wrapper)
│   ├── auth.js                   # Управление токенами
│   ├── websocket.js              # WebSocket-клиент (чат + уведомления)
│   ├── push.js                   # Web Push подписка
│   ├── notifications.js          # Управление уведомлениями
│   └── storage.js                # localStorage helper
├── router/
│   └── index.js
├── styles/
│   ├── variables.css             # CSS переменные (пастельная палитра)
│   ├── reset.css
│   ├── base.css
│   ├── components.css
│   ├── layout.css
│   ├── pages.css
│   ├── admin.css                 # Стили админки
│   └── responsive.css            # Медиа-запросы
├── utils/
│   ├── dom.js
│   ├── format.js
│   └── validate.js
├── main.js
└── sw.js                         # Service Worker для push
```

## CSS-дизайн система (пастельный минимализм)

```css
/* styles/variables.css */
:root {
  /* Пастельная палитра */
  --color-primary: #7C9CBF;         /* приглушённый голубой */
  --color-primary-hover: #6889AD;
  --color-primary-light: #E8F0F8;   /* фон акцента */
  --color-success: #7BC89C;         /* мятный */
  --color-success-light: #E8F8EF;
  --color-warning: #E8C87B;         /* песочный */
  --color-warning-light: #FFF8E8;
  --color-danger: #CF8B8B;          /* пыльная роза */
  --color-danger-light: #F8E8E8;

  /* Фоны */
  --color-bg: #F5F3F0;             /* тёплый серый */
  --color-surface: #FFFFFF;
  --color-surface-hover: #FAFAF8;
  --color-border: #E5E2DE;
  --color-border-light: #F0EDEA;

  /* Текст */
  --color-text: #2D3142;           /* тёмно-серый, не чёрный */
  --color-text-secondary: #8E8C94;
  --color-text-muted: #B5B3BA;

  /* Отступы */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;

  /* Шрифт */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.375rem;
  --font-size-2xl: 1.75rem;

  /* Радиусы (мягкие) */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-full: 9999px;

  /* Тени (лёгкие) */
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-sm: 0 2px 4px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.10);

  /* Переходы */
  --transition: 0.2s ease;
}
```

## Адаптивность (Mobile-first)

```css
/* styles/responsive.css */

/* Мобильный по умолчанию */
.container {
  padding: var(--space-md);
  width: 100%;
}

/* Планшет */
@media (min-width: 768px) {
  .container { padding: var(--space-lg); max-width: 720px; margin: 0 auto; }
  .admin-sidebar { display: flex; width: 240px; }
  .mobile-drawer { display: none; }
}

/* Десктоп */
@media (min-width: 1024px) {
  .container { max-width: 960px; }
}

/* Широкий десктоп */
@media (min-width: 1280px) {
  .container { max-width: 1200px; }
}
```

Принципы мобильной адаптации:
- **Таблицы → карточки** на экранах < 768px
- **Sidebar → drawer** (slide-in по свайпу или бургер-кнопке)
- **Модалки → bottom sheets** на мобильных
- **Touch targets >= 44px**
- Чат занимает **весь экран** на мобильных
- Фильтры тикетов — **collapsible** на мобильных

## Компонентная система

```javascript
// Базовый паттерн компонента
export class TicketCard {
  constructor({ ticket, onClick, readonly = false }) {
    this.ticket = ticket;
    this.onClick = onClick;
    this.readonly = readonly;
    this.el = this.render();
  }

  render() {
    const card = createElement('div', {
      class: `ticket-card ${this.readonly ? 'ticket-card--readonly' : ''}`
    });

    // ... построение DOM
    card.addEventListener('click', () => this.onClick(this.ticket.id));
    return card;
  }

  mount(parent) {
    parent.appendChild(this.el);
    return this;
  }

  destroy() {
    this.el.remove();
  }
}
```

## UX: Пользователь сразу видит обращения

Главная страница (`/`) для USER:
- **Сразу** показывает список всех обращений пользователя
- Карточки тикетов с цветовой индикацией статуса
- Кнопка "Новое обращение" — крупная, заметная
- Последние сообщения в каждом тикете видны превью
- Фильтр по статусу (tab-переключатель сверху)
