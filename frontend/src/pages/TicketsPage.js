import { el, clearEl } from '../utils/dom.js';
import { MainLayout } from '../components/layout/MainLayout.js';
import { Button } from '../components/ui/Button.js';
import { Spinner } from '../components/ui/Spinner.js';
import { Badge } from '../components/ui/Badge.js';
import { Toast } from '../components/ui/Toast.js';
import { formatDateTime, formatStatus, statusClass, formatPriority, priorityClass } from '../utils/format.js';

const STATUS_TABS = [
  { value: '', label: 'Все' },
  { value: 'OPEN', label: 'Открытые' },
  { value: 'IN_PROGRESS', label: 'В работе' },
  { value: 'WAITING_FOR_USER', label: 'Ожидают ответа' },
  { value: 'RESOLVED', label: 'Решённые' },
  { value: 'CLOSED', label: 'Закрытые' }
];

export class TicketsPage {
  constructor(router) {
    this.router = router;
    this.statusFilter = '';
    this.tickets = [];
    this.pagination = null;
    this.page = 1;
  }

  async render(container) {
    clearEl(container);

    const user = window.__auth.getUser();
    const layout = new MainLayout({ user, router: this.router, auth: window.__auth });
    layout.mount(container);

    this.content = layout.getContent();
    this._renderContent();
    await this._loadTickets();
  }

  _renderContent() {
    clearEl(this.content);

    // Header
    const header = el('div', { class: 'page-header' }, [
      el('h1', {}, 'Мои обращения'),
      new Button({
        text: '+ Новое обращение',
        onClick: () => this.router.navigate('/tickets/new')
      }).el
    ]);
    this.content.appendChild(header);

    // Tabs
    const tabs = el('div', { class: 'tabs mb-md' });
    for (const tab of STATUS_TABS) {
      const tabEl = el('button', {
        class: `tab${this.statusFilter === tab.value ? ' tab--active' : ''}`,
        onClick: () => {
          this.statusFilter = tab.value;
          this.page = 1;
          this._renderContent();
          this._loadTickets();
        }
      }, tab.label);
      tabs.appendChild(tabEl);
    }
    this.content.appendChild(tabs);

    // Список
    this.listContainer = el('div', { class: 'ticket-list' });
    this.content.appendChild(this.listContainer);

    // Пагинация
    this.paginationContainer = el('div');
    this.content.appendChild(this.paginationContainer);
  }

  async _loadTickets() {
    clearEl(this.listContainer);
    new Spinner().mount(this.listContainer);

    try {
      const api = window.__api;
      const query = { page: this.page, limit: 20 };
      if (this.statusFilter) query.status = this.statusFilter;

      const res = await api.get('/tickets', query);
      this.tickets = res.data;
      this.pagination = res.pagination;

      this._renderTickets();
    } catch (err) {
      clearEl(this.listContainer);
      Toast.error(err.message || 'Ошибка загрузки');
    }
  }

  _renderTickets() {
    clearEl(this.listContainer);

    if (this.tickets.length === 0) {
      this.listContainer.appendChild(el('div', { class: 'empty-state' }, [
        el('div', { class: 'empty-state__icon' }, '\uD83C\uDFAB'),
        el('div', { class: 'empty-state__title' }, 'Нет обращений'),
        el('div', { class: 'empty-state__text' },
          this.statusFilter ? 'Нет обращений с выбранным статусом' : 'Создайте первое обращение'
        )
      ]));
      return;
    }

    for (const ticket of this.tickets) {
      this.listContainer.appendChild(this._renderTicketCard(ticket));
    }

    // Пагинация
    this._renderPagination();
  }

  _renderTicketCard(ticket) {
    const statusCls = statusClass(ticket.status);

    const card = el('div', {
      class: `ticket-card ticket-card--${statusCls}${ticket.readonly ? ' ticket-card--readonly' : ''}`,
      onClick: () => this.router.navigate(`/tickets/${ticket.id}`)
    });

    // Header: номер + badges
    const headerRow = el('div', { class: 'ticket-card__header' }, [
      el('span', { class: 'ticket-card__number' }, `#${ticket.number}`),
      el('div', { class: 'flex gap-xs', style: { flexWrap: 'wrap' } }, [
        new Badge(formatStatus(ticket.status), statusCls).el,
        new Badge(formatPriority(ticket.priority), priorityClass(ticket.priority)).el,
        ticket.topicGroup ? new Badge(ticket.topicGroup.name, 'in-progress').el : null,
        ticket.hasPendingDelegation ? new Badge('\u21C4 Делегирование', 'waiting').el : null,
        ticket.readonly ? new Badge('Только чтение', 'closed').el : null
      ].filter(Boolean))
    ]);

    // Title
    const title = el('div', { class: 'ticket-card__title' }, ticket.title);

    // Meta
    const metaParts = [formatDateTime(ticket.createdAt)];
    if (ticket.author) metaParts.push(ticket.author.displayName);
    if (ticket.assignee) metaParts.push(`Агент: ${ticket.assignee.displayName}`);

    const meta = el('div', { class: 'ticket-card__meta' },
      metaParts.join(' \u00B7 ')
    );

    card.appendChild(headerRow);
    card.appendChild(title);
    card.appendChild(meta);

    return card;
  }

  _renderPagination() {
    clearEl(this.paginationContainer);
    if (!this.pagination || this.pagination.totalPages <= 1) return;

    const pag = el('div', { class: 'pagination' });

    for (let i = 1; i <= this.pagination.totalPages; i++) {
      const btn = el('button', {
        class: `pagination__btn${i === this.page ? ' pagination__btn--active' : ''}`,
        onClick: () => {
          this.page = i;
          this._loadTickets();
        }
      }, String(i));
      pag.appendChild(btn);
    }

    this.paginationContainer.appendChild(pag);
  }
}
