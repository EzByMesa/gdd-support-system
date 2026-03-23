import { el } from '../../utils/dom.js';
import { Header } from './Header.js';
import { AdminSidebar } from './AdminSidebar.js';
import { MobileDrawer } from './MobileDrawer.js';

const ADMIN_NAV = [
  { path: '/admin/dashboard', icon: '\uD83D\uDCCA', label: 'Дашборд' },
  { path: '/admin/users', icon: '\uD83D\uDC65', label: 'Пользователи' },
  { path: '/admin/tickets', icon: '\uD83C\uDFAB', label: 'Тикеты' },
  { path: '/admin/topic-groups', icon: '\uD83D\uDCC2', label: 'Тематики' },
  { path: '/admin/auth', icon: '\uD83D\uDD10', label: 'Авторизация' },
  { path: '/admin/settings', icon: '\u2699\uFE0F', label: 'Настройки' },
  { path: '/api/docs', icon: '\uD83D\uDCD6', label: 'API Документация', external: true }
];

/**
 * Layout для Admin-панели.
 * Header + Sidebar + Content.
 * На мобильных — sidebar заменяется на drawer.
 */
export class AdminLayout {
  constructor({ user, router, auth }) {
    this.router = router;
    this.auth = auth;
    this.drawer = null;

    this.el = el('div', { class: 'admin-layout' });

    this.header = new Header({
      user,
      isAdmin: false, // мы уже в админке
      showBurger: true,
      onBurgerClick: () => this._openDrawer(),
      onLogout: () => this._logout(),
      onNotificationsClick: () => { /* TODO */ }
    });

    // Заменяем логотип
    const logo = this.header.el.querySelector('.header__logo');
    if (logo) {
      logo.textContent = 'GDD Admin';
      logo.href = '#/admin/dashboard';
    }

    const body = el('div', { class: 'admin-body' });

    this.sidebar = new AdminSidebar();
    this.content = el('main', { class: 'admin-content' });

    body.appendChild(this.sidebar.el);
    body.appendChild(this.content);

    this.el.appendChild(this.header.el);
    this.el.appendChild(body);
  }

  getContent() {
    return this.content;
  }

  _openDrawer() {
    this.drawer = new MobileDrawer({
      title: 'GDD Admin',
      items: ADMIN_NAV
    });
    this.drawer.open();
  }

  async _logout() {
    await this.auth.logout();
    this.router.navigate('/login');
  }

  mount(parent) {
    parent.appendChild(this.el);
    return this;
  }
}
