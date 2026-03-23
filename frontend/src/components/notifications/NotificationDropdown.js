import { el, clearEl } from '../../utils/dom.js';
import { formatDateTime } from '../../utils/format.js';

const TYPE_ICONS = {
  NEW_MESSAGE: '\uD83D\uDCAC',
  STATUS_CHANGED: '\uD83D\uDD04',
  TICKET_ASSIGNED: '\uD83D\uDC64',
  DELEGATION_REQUEST: '\u21C4',
  DELEGATION_ACCEPTED: '\u2705',
  DELEGATION_REJECTED: '\u274C',
  AGENT_CHANGED: '\uD83D\uDD00'
};

export class NotificationDropdown {
  constructor({ notificationService, onNavigate }) {
    this.notifService = notificationService;
    this.onNavigate = onNavigate;
    this.isOpen = false;

    this.el = el('div', { class: 'dropdown' });

    this.menu = el('div', {
      class: 'dropdown__menu',
      style: { minWidth: '340px', maxHeight: '400px', overflowY: 'auto', display: 'none' }
    });

    this.el.appendChild(this.menu);
  }

  async toggle(anchorEl) {
    this.isOpen = !this.isOpen;

    if (this.isOpen) {
      const isMobile = window.innerWidth < 768;

      if (isMobile) {
        // Fullscreen на мобильных
        this.menu.style.position = 'fixed';
        this.menu.style.top = '0';
        this.menu.style.left = '0';
        this.menu.style.right = '0';
        this.menu.style.bottom = '0';
        this.menu.style.maxHeight = '100vh';
        this.menu.style.width = '100%';
        this.menu.style.borderRadius = '0';
        this.menu.style.zIndex = 'var(--z-modal)';
        this.menu.style.display = 'block';

        // Backdrop
        this._backdrop = el('div', {
          class: 'modal-backdrop',
          onClick: () => this.close()
        });
        document.body.appendChild(this._backdrop);
      } else {
        // Dropdown на десктопе
        const rect = anchorEl.getBoundingClientRect();
        this.menu.style.position = 'fixed';
        this.menu.style.top = (rect.bottom + 4) + 'px';
        this.menu.style.right = (window.innerWidth - rect.right) + 'px';
        this.menu.style.left = 'auto';
        this.menu.style.bottom = 'auto';
        this.menu.style.width = '';
        this.menu.style.borderRadius = '';
        this.menu.style.display = 'block';
      }

      document.body.appendChild(this.el);
      await this._load();

      // Закрытие по клику вне
      this._outsideHandler = (e) => {
        if (!this.el.contains(e.target) && e.target !== anchorEl) {
          this.close();
        }
      };
      setTimeout(() => document.addEventListener('click', this._outsideHandler), 0);
    } else {
      this.close();
    }
  }

  close() {
    this.isOpen = false;
    this.menu.style.display = 'none';
    this.el.remove();
    if (this._backdrop) {
      this._backdrop.remove();
      this._backdrop = null;
    }
    if (this._outsideHandler) {
      document.removeEventListener('click', this._outsideHandler);
    }
  }

  async _load() {
    clearEl(this.menu);

    // Header
    const isMobile = window.innerWidth < 768;
    const headerChildren = [
      el('span', { style: { fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)' } }, 'Уведомления'),
      el('div', { class: 'flex gap-sm items-center' }, [
        el('button', {
          style: { fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', cursor: 'pointer', background: 'none', border: 'none' },
          onClick: async () => {
            await this.notifService.markAllRead();
            await this._load();
          }
        }, 'Прочитать все'),
        isMobile ? el('button', {
          style: { fontSize: '20px', color: 'var(--color-text-muted)', cursor: 'pointer', background: 'none', border: 'none', marginLeft: '8px' },
          onClick: () => this.close()
        }, '\u00D7') : null
      ].filter(Boolean))
    ];

    const header = el('div', {
      class: 'flex items-center justify-between',
      style: { padding: 'var(--space-sm) var(--space-md)', borderBottom: '1px solid var(--color-border-light)', minHeight: isMobile ? '50px' : 'auto' }
    }, headerChildren);
    this.menu.appendChild(header);

    try {
      const items = await this.notifService.loadList(15);

      if (items.length === 0) {
        this.menu.appendChild(el('div', {
          style: { padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }
        }, 'Нет уведомлений'));
        return;
      }

      for (const item of items) {
        this.menu.appendChild(this._renderItem(item));
      }
    } catch {
      this.menu.appendChild(el('div', {
        style: { padding: 'var(--space-md)', color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }
      }, 'Ошибка загрузки'));
    }
  }

  _renderItem(item) {
    const row = el('button', {
      class: 'dropdown__item',
      style: {
        background: item.isRead ? '' : 'var(--color-primary-light)',
        alignItems: 'flex-start'
      },
      onClick: async () => {
        if (!item.isRead) {
          await this.notifService.markRead(item.id);
        }
        this.close();
        if (item.data?.ticketId && this.onNavigate) {
          this.onNavigate(`/tickets/${item.data.ticketId}`);
        }
      }
    });

    const icon = el('span', { style: { fontSize: '16px', flexShrink: '0', marginTop: '2px' } },
      TYPE_ICONS[item.type] || '\uD83D\uDD14'
    );

    const content = el('div', { class: 'flex-col', style: { gap: '2px', flex: '1' } }, [
      el('span', { style: { fontWeight: item.isRead ? 'normal' : 'var(--font-weight-medium)' } }, item.title),
      el('span', { style: { color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' } }, item.body),
      el('span', { style: { color: 'var(--color-text-muted)', fontSize: '11px' } }, formatDateTime(item.createdAt))
    ]);

    row.appendChild(icon);
    row.appendChild(content);
    return row;
  }
}
