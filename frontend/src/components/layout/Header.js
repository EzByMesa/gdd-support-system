import { el } from '../../utils/dom.js';
import { NotificationDropdown } from '../notifications/NotificationDropdown.js';

export class Header {
  /**
   * @param {object} opts
   * @param {object} opts.user - { displayName, role }
   * @param {boolean} opts.isAdmin - показывать ли ссылку на админку
   * @param {boolean} opts.showBurger
   * @param {Function} opts.onBurgerClick
   * @param {Function} opts.onLogout
   * @param {Function} opts.onNotificationsClick
   * @param {Function} opts.onAdminClick
   * @param {number} opts.unreadCount
   */
  constructor({ user, isAdmin, showBurger, onBurgerClick, onLogout, onNotificationsClick, onAdminClick, unreadCount = 0 } = {}) {
    this.el = el('header', { class: 'header' });

    // Burger (мобильный)
    if (showBurger) {
      this.el.appendChild(
        el('button', { class: 'header__burger', onClick: onBurgerClick }, '\u2630')
      );
    }

    // Logo
    this.el.appendChild(
      el('a', { class: 'header__logo', href: '#/' }, 'GDD Support')
    );

    // Actions
    const actions = el('div', { class: 'header__actions' });

    // Кнопка админки (если админ и не в админке)
    if (isAdmin && onAdminClick) {
      actions.appendChild(
        el('button', { class: 'header__icon-btn', onClick: onAdminClick, title: 'Админ-панель' }, '\u2699')
      );
    }

    // Колокольчик
    // Колокольчик с dropdown
    this.notifDropdown = null;
    const notifService = window.__notifService;

    const bellBtn = el('button', {
      class: 'header__icon-btn',
      onClick: () => {
        if (notifService) {
          if (!this.notifDropdown) {
            this.notifDropdown = new NotificationDropdown({
              notificationService: notifService,
              onNavigate: (path) => { window.location.hash = path; }
            });
          }
          this.notifDropdown.toggle(bellBtn);
        } else if (onNotificationsClick) {
          onNotificationsClick();
        }
      },
      title: 'Уведомления'
    }, '\uD83D\uDD14');

    if (unreadCount > 0) {
      bellBtn.appendChild(
        el('span', { class: 'badge--count' }, String(unreadCount > 99 ? '99+' : unreadCount))
      );
    }
    this.bellBtn = bellBtn;
    actions.appendChild(bellBtn);

    // Кнопка делегирований (для агентов)
    if (user && (user.role === 'AGENT' || user.role === 'ADMIN')) {
      const delegBtn = el('button', {
        class: 'header__icon-btn',
        title: 'Делегирование',
        onClick: () => { window.location.hash = '/delegations'; }
      }, '\u21C4');
      this.delegBtn = delegBtn;
      actions.appendChild(delegBtn);

      // Загружаем количество входящих
      this._loadDelegationCount();
    }

    // Пользователь
    if (user) {
      const initials = user.displayName
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      const userEl = el('div', { class: 'header__user' }, [
        el('div', { class: 'header__avatar' }, initials),
        el('span', { class: 'header__username' }, user.displayName)
      ]);
      actions.appendChild(userEl);
    }

    // Выход
    actions.appendChild(
      el('button', { class: 'btn btn--ghost btn--sm', onClick: onLogout }, 'Выход')
    );

    this.el.appendChild(actions);

    // Подписка на real-time обновление счётчика
    if (notifService) {
      notifService.onChange((count) => this.updateUnreadCount(count));
      this.updateUnreadCount(notifService.unreadCount);
    }
  }

  async _loadDelegationCount() {
    try {
      const api = window.__api;
      if (!api || !api.accessToken) return;
      const res = await api.get('/delegations/incoming/count');
      const count = res.data?.count || 0;
      if (count > 0 && this.delegBtn) {
        this.delegBtn.appendChild(
          el('span', { class: 'badge--count' }, String(count))
        );
      }
    } catch {
      // silent
    }
  }

  updateUnreadCount(count) {
    const existing = this.bellBtn.querySelector('.badge--count');
    if (existing) existing.remove();
    if (count > 0) {
      this.bellBtn.appendChild(
        el('span', { class: 'badge--count' }, String(count > 99 ? '99+' : count))
      );
    }
  }

  mount(parent) {
    parent.appendChild(this.el);
    return this;
  }
}
