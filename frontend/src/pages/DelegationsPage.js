import { el, clearEl } from '../utils/dom.js';
import { MainLayout } from '../components/layout/MainLayout.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Spinner } from '../components/ui/Spinner.js';
import { Toast } from '../components/ui/Toast.js';
import { formatDateTime } from '../utils/format.js';

export class DelegationsPage {
  constructor(router) {
    this.router = router;
    this.tab = 'incoming'; // incoming | outgoing
    this.items = [];
  }

  async render(container) {
    clearEl(container);

    const user = window.__auth.getUser();
    const layout = new MainLayout({ user, router: this.router, auth: window.__auth });
    layout.mount(container);

    this.content = layout.getContent();
    this._renderContent();
    await this._load();
  }

  _renderContent() {
    clearEl(this.content);

    this.content.appendChild(el('div', { class: 'page-header' }, [
      el('h1', {}, 'Делегирование'),
      new Button({ text: '\u2190 Назад', variant: 'ghost', onClick: () => this.router.navigate('/') }).el
    ]));

    // Tabs
    const tabs = el('div', { class: 'tabs mb-md' });
    tabs.appendChild(el('button', {
      class: `tab${this.tab === 'incoming' ? ' tab--active' : ''}`,
      onClick: () => { this.tab = 'incoming'; this._renderContent(); this._load(); }
    }, 'Входящие'));
    tabs.appendChild(el('button', {
      class: `tab${this.tab === 'outgoing' ? ' tab--active' : ''}`,
      onClick: () => { this.tab = 'outgoing'; this._renderContent(); this._load(); }
    }, 'Исходящие'));
    this.content.appendChild(tabs);

    this.listEl = el('div', { class: 'flex-col gap-sm' });
    this.content.appendChild(this.listEl);
  }

  async _load() {
    clearEl(this.listEl);
    new Spinner().mount(this.listEl);

    try {
      const api = window.__api;
      const endpoint = this.tab === 'incoming' ? '/delegations/incoming?status=PENDING' : '/delegations/outgoing';
      const res = await api.get(endpoint);
      this.items = res.data || [];
      this._renderList();
    } catch (err) {
      clearEl(this.listEl);
      Toast.error(err.message);
    }
  }

  _renderList() {
    clearEl(this.listEl);

    if (this.items.length === 0) {
      this.listEl.appendChild(el('div', { class: 'empty-state' }, [
        el('div', { class: 'empty-state__icon' }, '\u21C4'),
        el('div', { class: 'empty-state__title' }, 'Нет запросов'),
        el('div', { class: 'empty-state__text' },
          this.tab === 'incoming' ? 'Нет входящих запросов на делегирование' : 'Вы не отправляли запросов'
        )
      ]));
      return;
    }

    for (const item of this.items) {
      this.listEl.appendChild(this._renderCard(item));
    }
  }

  _renderCard(item) {
    const card = el('div', { class: 'card' });

    // Header
    const header = el('div', { class: 'flex items-center justify-between mb-sm' });
    const ticketLink = el('a', {
      href: `#/tickets/${item.ticket?.id}`,
      style: { fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-primary)' }
    }, `#${item.ticket?.number} ${item.ticket?.title || ''}`);
    header.appendChild(ticketLink);

    const statusMap = { PENDING: 'waiting', ACCEPTED: 'open', REJECTED: 'closed' };
    const statusLabel = { PENDING: 'Ожидает', ACCEPTED: 'Принято', REJECTED: 'Отклонено' };
    header.appendChild(new Badge(statusLabel[item.status] || item.status, statusMap[item.status] || 'closed').el);
    card.appendChild(header);

    // Info
    const agentName = this.tab === 'incoming'
      ? `От: ${item.fromAgent?.displayName || '?'}`
      : `Кому: ${item.toAgent?.displayName || '?'}`;

    card.appendChild(el('div', { class: 'text-sm text-secondary mb-sm' },
      `${agentName} \u00B7 ${formatDateTime(item.createdAt)}`
    ));

    if (item.message) {
      card.appendChild(el('div', { class: 'text-sm mb-sm', style: { fontStyle: 'italic' } },
        `"${item.message}"`
      ));
    }

    // Actions (только для incoming PENDING)
    if (this.tab === 'incoming' && item.status === 'PENDING') {
      const actions = el('div', { class: 'flex gap-sm mt-sm' });

      const acceptBtn = new Button({
        text: 'Принять', size: 'sm',
        onClick: () => this._respond(item.id, true, acceptBtn)
      });
      const rejectBtn = new Button({
        text: 'Отклонить', variant: 'danger', size: 'sm',
        onClick: () => this._respond(item.id, false, rejectBtn)
      });

      acceptBtn.mount(actions);
      rejectBtn.mount(actions);
      card.appendChild(actions);
    }

    return card;
  }

  async _respond(delegationId, accept, btn) {
    btn.setLoading(true);
    try {
      const api = window.__api;
      await api.put(`/delegations/${delegationId}/respond`, { accept });
      Toast.success(accept ? 'Тикет принят!' : 'Делегирование отклонено');
      await this._load();
    } catch (err) {
      Toast.error(err.message);
      btn.setLoading(false);
    }
  }
}
