import { el } from '../../utils/dom.js';

export class MobileDrawer {
  /**
   * @param {object} opts
   * @param {string} opts.title
   * @param {Array<{path, icon, label}>} opts.items
   */
  constructor({ title = 'Меню', items = [] } = {}) {
    this.items = items;

    this.backdrop = el('div', {
      class: 'drawer-backdrop',
      onClick: () => this.close()
    });

    this.drawer = el('div', { class: 'drawer' });

    const header = el('div', { class: 'drawer__header' }, [
      el('span', { style: { fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-lg)' } }, title),
      el('button', { class: 'drawer__close', onClick: () => this.close() }, '\u00D7')
    ]);

    this.nav = el('nav', { class: 'admin-sidebar__nav' });

    this.drawer.appendChild(header);
    this.drawer.appendChild(this.nav);

    this._renderItems();
  }

  _renderItems() {
    this.nav.innerHTML = '';
    const currentHash = window.location.hash.slice(1);

    for (const item of this.items) {
      const isActive = !item.external && (currentHash === item.path || currentHash.startsWith(item.path + '/'));

      const attrs = {
        class: `admin-sidebar__link${isActive ? ' admin-sidebar__link--active' : ''}`,
        href: item.external ? item.path : `#${item.path}`,
        onClick: () => this.close()
      };
      if (item.external) {
        attrs.target = '_blank';
        attrs.style = { color: 'var(--color-primary)' };
      }

      const link = el('a', attrs, [
        el('span', { class: 'admin-sidebar__icon' }, item.icon),
        item.label
      ]);

      this.nav.appendChild(link);
    }
  }

  open() {
    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.drawer);
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.backdrop.remove();
    this.drawer.remove();
    document.body.style.overflow = '';
  }
}
