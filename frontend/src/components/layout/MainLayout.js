import { el } from '../../utils/dom.js';
import { Header } from './Header.js';

/**
 * Layout для User / Agent.
 * Header + Content.
 */
export class MainLayout {
  /**
   * @param {object} opts
   * @param {object} opts.user
   * @param {object} opts.router
   * @param {object} opts.auth
   */
  constructor({ user, router, auth }) {
    this.router = router;
    this.auth = auth;

    this.el = el('div', { class: 'main-layout' });

    this.header = new Header({
      user,
      isAdmin: user?.role === 'ADMIN',
      showBurger: false,
      onLogout: () => this._logout(),
      onNotificationsClick: () => { /* TODO */ },
      onAdminClick: user?.role === 'ADMIN' ? () => router.navigate('/admin/dashboard') : null
    });

    this.content = el('main', { class: 'main-content' });

    this.el.appendChild(this.header.el);
    this.el.appendChild(this.content);
  }

  getContent() {
    return this.content;
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
