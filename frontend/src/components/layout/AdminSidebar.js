import { el } from '../../utils/dom.js';

const NAV_ITEMS = [
  { path: '/admin/dashboard', icon: '\uD83D\uDCCA', label: 'Дашборд' },
  { path: '/admin/users', icon: '\uD83D\uDC65', label: 'Пользователи' },
  { path: '/admin/tickets', icon: '\uD83C\uDFAB', label: 'Тикеты' },
  { path: '/admin/topic-groups', icon: '\uD83D\uDCC2', label: 'Тематики' },
  { path: '/admin/auth', icon: '\uD83D\uDD10', label: 'Авторизация' },
  { path: '/admin/settings', icon: '\u2699\uFE0F', label: 'Настройки' }
];

export class AdminSidebar {
  constructor() {
    this.el = el('aside', { class: 'admin-sidebar' });
    this.nav = el('nav', { class: 'admin-sidebar__nav' });
    this.el.appendChild(this.nav);

    // Footer: API Docs + На сайт
    const footer = el('div', { class: 'admin-sidebar__footer' });

    footer.appendChild(el('a', {
      class: 'admin-sidebar__link',
      href: '/api/docs',
      target: '_blank',
      style: { color: 'var(--color-primary)' }
    }, [
      el('span', { class: 'admin-sidebar__icon' }, '\uD83D\uDCD6'),
      'API Документация'
    ]));

    footer.appendChild(el('a', { class: 'admin-sidebar__link', href: '#/' }, [
      el('span', { class: 'admin-sidebar__icon' }, '\u2190'),
      'На сайт'
    ]));

    this.el.appendChild(footer);

    this._render();

    // Обновлять активный пункт при навигации
    window.addEventListener('hashchange', () => this._render());
  }

  _render() {
    this.nav.innerHTML = '';
    const currentHash = window.location.hash.slice(1) || '/admin/dashboard';

    for (const item of NAV_ITEMS) {
      const isActive = currentHash === item.path || currentHash.startsWith(item.path + '/');

      const link = el('a', {
        class: `admin-sidebar__link${isActive ? ' admin-sidebar__link--active' : ''}`,
        href: `#${item.path}`
      }, [
        el('span', { class: 'admin-sidebar__icon' }, item.icon),
        item.label
      ]);

      this.nav.appendChild(link);
    }
  }

  mount(parent) {
    parent.appendChild(this.el);
    return this;
  }
}
