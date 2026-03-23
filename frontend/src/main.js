import { Router } from './router/index.js';
import { AuthService } from './services/auth.js';
import { ApiService } from './services/api.js';
import { SetupWizardPage } from './pages/SetupWizardPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { TicketsPage } from './pages/TicketsPage.js';
import { NewTicketPage } from './pages/NewTicketPage.js';
import { TicketDetailPage } from './pages/TicketDetailPage.js';
import { DelegationsPage } from './pages/DelegationsPage.js';
import { TopicGroupsPage } from './pages/TopicGroupsPage.js';
import { PushService } from './services/push.js';
import { NotificationService } from './services/notifications.js';
import { WsClient } from './services/websocket.js';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.js';
import { AdminUsersPage } from './pages/admin/AdminUsersPage.js';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage.js';
import { AdminAuthPage } from './pages/admin/AdminAuthPage.js';
import { AdminTicketsPage } from './pages/admin/AdminTicketsPage.js';
import { AdminTopicGroupsPage } from './pages/admin/AdminTopicGroupsPage.js';

// Глобальные сервисы
export const api = new ApiService();
export const auth = new AuthService(api);
export const router = new Router();
export const pushService = new PushService(api);
export const notifService = new NotificationService(api);

// Доступ из страниц
window.__auth = auth;
window.__api = api;
window.__router = router;
window.__notifService = notifService;
window.__pushService = pushService;

// При протухшей сессии — на логин
api.onUnauthorized = () => {
  auth.user = null;
  router.navigate('/login');
};

// Redirect helper
class AdminRedirect {
  constructor(r) { r.navigate('/admin/dashboard'); }
  render() {}
}

// --- Регистрация маршрутов ---
router.setAuthProvider(() => auth.getUser());

// Public
router.route('/setup', SetupWizardPage, { guest: true });
router.route('/login', LoginPage, { guest: true });
router.route('/register', RegisterPage, { guest: true });

// Tickets
router.route('/', TicketsPage, { roles: ['USER', 'AGENT', 'ADMIN'] });
router.route('/tickets/new', NewTicketPage, { roles: ['USER', 'AGENT', 'ADMIN'] });
router.route('/tickets/:id', TicketDetailPage, { roles: ['USER', 'AGENT', 'ADMIN'] });

// Delegations (Agent / Admin)
router.route('/delegations', DelegationsPage, { roles: ['AGENT', 'ADMIN'] });

// Topic Groups (Agent / Admin)
router.route('/topic-groups', TopicGroupsPage, { roles: ['AGENT', 'ADMIN'] });

// Admin
router.route('/admin', AdminRedirect, { roles: ['ADMIN'] });
router.route('/admin/dashboard', AdminDashboardPage, { roles: ['ADMIN'] });
router.route('/admin/users', AdminUsersPage, { roles: ['ADMIN'] });
router.route('/admin/tickets', AdminTicketsPage, { roles: ['ADMIN'] });
router.route('/admin/topic-groups', AdminTopicGroupsPage, { roles: ['ADMIN'] });
router.route('/admin/auth', AdminAuthPage, { roles: ['ADMIN'] });
router.route('/admin/settings', AdminSettingsPage, { roles: ['ADMIN'] });

// --- Init ---
async function init() {
  const app = document.getElementById('app');

  // Проверяем настройку системы
  try {
    const res = await fetch('/api/setup/status');
    if (res.ok) {
      const { data } = await res.json();
      if (data.needsSetup) {
        router.start(app);
        router.navigate('/setup');
        return;
      }
    } else if (res.status === 503) {
      router.start(app);
      router.navigate('/setup');
      return;
    }
  } catch {
    app.innerHTML = `
      <div class="error-screen">
        <h1>Сервер недоступен</h1>
        <p>Не удалось подключиться к серверу. Попробуйте позже.</p>
      </div>
    `;
    return;
  }

  // Восстановление сессии
  await auth.tryRestore();

  // Запуск роутера
  router.start(app);

  if (auth.isAuthenticated()) {
    // Инициализация push и уведомлений
    initNotifications();
  } else {
    const hash = window.location.hash.slice(1);
    if (hash !== '/register') {
      router.navigate('/login');
    }
  }
}

/**
 * Инициализация push-уведомлений и WS-канала уведомлений
 */
async function initNotifications() {
  // Загружаем счётчик непрочитанных
  await notifService.loadCount();

  // Инициализируем push (Service Worker)
  await pushService.init();

  // Если push ещё не подписан — предложим позже (не спамим сразу)
  // pushService.subscribe() вызывается из UI по кнопке

  // WS-канал для real-time уведомлений (без ticketId — глобальный)
  const wsNotif = new WsClient({
    onNotification: (data) => {
      notifService.handleIncoming(data);
    }
  });
  wsNotif.connect();
  window.__wsNotif = wsNotif;
}

// Глобальная обработка ошибок
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Unhandled]', e.reason);
  e.preventDefault();
});

init();
