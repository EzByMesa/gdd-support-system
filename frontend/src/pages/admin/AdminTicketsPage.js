import { el, clearEl } from '../../utils/dom.js';
import { AdminLayout } from '../../components/layout/AdminLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { Badge } from '../../components/ui/Badge.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { Toast } from '../../components/ui/Toast.js';
import { formatDateTime, formatStatus, statusClass, formatPriority, priorityClass } from '../../utils/format.js';

export class AdminTicketsPage {
  constructor(router) {
    this.router = router;
    this.tickets = [];
    this.page = 1;
    this.filters = {};
  }

  async render(container) {
    clearEl(container);

    const user = window.__auth.getUser();
    const layout = new AdminLayout({ user, router: this.router, auth: window.__auth });
    layout.mount(container);

    this.content = layout.getContent();
    this._renderContent();
    await this._load();
  }

  _renderContent() {
    clearEl(this.content);

    this.content.appendChild(el('div', { class: 'page-header' }, [el('h1', {}, 'Все тикеты')]));

    // Filters
    const filters = el('div', { class: 'tickets-filters' });

    new Select({
      placeholder: 'Статус',
      options: [
        { value: '', text: 'Все статусы' },
        { value: 'OPEN', text: 'Открытые' },
        { value: 'IN_PROGRESS', text: 'В работе' },
        { value: 'WAITING_FOR_USER', text: 'Ожидают ответа' },
        { value: 'RESOLVED', text: 'Решённые' },
        { value: 'CLOSED', text: 'Закрытые' }
      ],
      onChange: (val) => { this.filters.status = val; this.page = 1; this._load(); }
    }).mount(filters);

    new Select({
      placeholder: 'Приоритет',
      options: [
        { value: '', text: 'Все приоритеты' },
        { value: 'LOW', text: 'Низкий' },
        { value: 'MEDIUM', text: 'Средний' },
        { value: 'HIGH', text: 'Высокий' },
        { value: 'CRITICAL', text: 'Критичный' }
      ],
      onChange: (val) => { this.filters.priority = val; this.page = 1; this._load(); }
    }).mount(filters);

    this.content.appendChild(filters);

    this.listEl = el('div', { class: 'flex-col gap-xs' });
    this.content.appendChild(this.listEl);
  }

  async _load() {
    clearEl(this.listEl);
    new Spinner().mount(this.listEl);

    try {
      const query = { page: this.page, limit: 30, ...this.filters };
      const res = await window.__api.get('/tickets', query);
      this.tickets = res.data || [];
      this._renderTickets();
    } catch (err) {
      clearEl(this.listEl);
      Toast.error(err.message);
    }
  }

  _renderTickets() {
    clearEl(this.listEl);

    if (this.tickets.length === 0) {
      this.listEl.appendChild(el('div', { class: 'empty-state' }, [
        el('div', { class: 'empty-state__title' }, 'Нет тикетов')
      ]));
      return;
    }

    for (const t of this.tickets) {
      const card = el('a', {
        href: `#/tickets/${t.id}`,
        class: 'card card--hoverable flex items-center justify-between gap-md',
        style: { padding: 'var(--space-sm) var(--space-md)' }
      }, [
        el('div', { class: 'flex items-center gap-md', style: { flex: '1', minWidth: '0' } }, [
          el('span', { class: 'text-muted text-xs', style: { flexShrink: '0' } }, `#${t.number}`),
          el('span', { style: { fontSize: 'var(--font-size-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, t.title)
        ]),
        el('div', { class: 'flex items-center gap-xs', style: { flexShrink: '0' } }, [
          new Badge(formatStatus(t.status), statusClass(t.status)).el,
          new Badge(formatPriority(t.priority), priorityClass(t.priority)).el,
          el('span', { class: 'text-muted text-xs' }, t.author?.displayName || ''),
          el('span', { class: 'text-muted text-xs' }, formatDateTime(t.createdAt))
        ])
      ]);

      this.listEl.appendChild(card);
    }
  }
}
