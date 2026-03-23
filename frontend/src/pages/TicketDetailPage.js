import { el, clearEl } from '../utils/dom.js';
import { MainLayout } from '../components/layout/MainLayout.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Spinner } from '../components/ui/Spinner.js';
import { Toast } from '../components/ui/Toast.js';
import { formatDateTime, formatStatus, statusClass, formatPriority, priorityClass, formatFileSize } from '../utils/format.js';
import { ChatWindow } from '../components/chat/ChatWindow.js';
import { DelegateModal } from '../components/tickets/DelegateModal.js';

export class TicketDetailPage {
  constructor(router, params) {
    this.router = router;
    this.ticketId = params.id;
    this.ticket = null;
    this.chatWindow = null;
  }

  async render(container) {
    clearEl(container);

    const user = window.__auth.getUser();
    this.user = user;

    const layout = new MainLayout({ user, router: this.router, auth: window.__auth });
    layout.mount(container);

    this.content = layout.getContent();

    // Загружаем тикет
    new Spinner().mount(this.content);
    await this._loadTicket();
  }

  async _loadTicket() {
    try {
      const api = window.__api;
      const res = await api.get(`/tickets/${this.ticketId}`);
      this.ticket = res.data;
      this._renderDetail();
    } catch (err) {
      clearEl(this.content);
      this.content.appendChild(el('div', { class: 'error-screen' }, [
        el('h1', {}, 'Обращение не найдено'),
        el('p', {}, err.message),
        new Button({ text: '\u2190 Назад', onClick: () => this.router.navigate('/') }).el
      ]));
    }
  }

  _renderDetail() {
    clearEl(this.content);
    const t = this.ticket;

    // Header
    const header = el('div', { class: 'page-header' }, [
      el('div', { class: 'flex items-center gap-md' }, [
        new Button({ text: '\u2190', variant: 'ghost', onClick: () => this.router.navigate('/') }).el,
        el('h1', {}, `#${t.number} ${t.title}`)
      ])
    ]);
    this.content.appendChild(header);

    // Grid: main + sidebar
    const grid = el('div', { class: 'ticket-detail' });

    // === Main ===
    const main = el('div', { class: 'ticket-detail__main' });

    // Описание
    const descCard = el('div', { class: 'card' });
    descCard.appendChild(el('h3', { class: 'mb-sm' }, 'Описание'));
    const descText = el('p', { style: { whiteSpace: 'pre-wrap', fontSize: 'var(--font-size-sm)', lineHeight: '1.6' } });
    descText.textContent = t.description;
    descCard.appendChild(descText);

    // Вложения
    if (t.attachments && t.attachments.length > 0) {
      descCard.appendChild(el('div', { class: 'divider' }));
      descCard.appendChild(el('h3', { class: 'mb-sm' }, 'Вложения'));
      const attList = el('div', { class: 'flex-col gap-xs' });
      for (const att of t.attachments) {
        const attItem = el('a', {
          href: `/api/attachments/${att.id}/download`,
          class: 'flex items-center gap-sm',
          style: { fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' },
          target: '_blank'
        }, [
          el('span', {}, '\uD83D\uDCCE'),
          el('span', {}, `${att.originalName} (${formatFileSize(att.size)})`)
        ]);
        attList.appendChild(attItem);
      }
      descCard.appendChild(attList);
    }

    main.appendChild(descCard);

    // Чат
    const chatSection = el('div');
    chatSection.appendChild(el('h3', { class: 'mb-sm' }, 'Чат'));

    // Чат доступен если: USER — свой тикет, AGENT — назначенный на себя, ADMIN — любой
    const canChat = this.user.role === 'ADMIN'
      || (this.user.role === 'USER' && t.author?.id === this.user.id)
      || (this.user.role === 'AGENT' && t.assignee?.id === this.user.id);

    if (this.chatWindow) this.chatWindow.destroy();

    this.chatWindow = new ChatWindow({
      ticketId: this.ticketId,
      currentUserId: this.user.id,
      readonly: !canChat || t.readonly
    });
    this.chatWindow.mount(chatSection);
    this.chatWindow.connect();

    main.appendChild(chatSection);

    // === Sidebar ===
    const sidebar = el('div', { class: 'ticket-detail__sidebar' });

    // Actions
    if (!t.readonly) {
      const actionsCard = el('div', { class: 'card flex-col gap-sm' });

      const isAgentOrAdmin = this.user.role === 'AGENT' || this.user.role === 'ADMIN';

      // Взять в работу (любой OPEN тикет для агента/админа)
      if (isAgentOrAdmin && t.status === 'OPEN') {
        new Button({
          text: 'Взять в работу', block: true,
          onClick: () => this._assignTicket()
        }).mount(actionsCard);
      }

      // Кнопки быстрой смены статуса (для назначенного агента)
      if (isAgentOrAdmin && t.assignee?.id === this.user.id) {
        actionsCard.appendChild(el('div', {
          style: { fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)' }
        }, 'Сменить статус:'));

        const statusBtns = [
          { value: 'IN_PROGRESS', text: 'В работе', variant: 'primary' },
          { value: 'WAITING_FOR_USER', text: 'Ожидает ответа', variant: 'secondary' },
          { value: 'RESOLVED', text: 'Решён', variant: 'secondary' },
          { value: 'CLOSED', text: 'Закрыт', variant: 'ghost' }
        ];

        const btnGrid = el('div', { class: 'flex-col gap-xs' });
        for (const s of statusBtns) {
          const isCurrent = t.status === s.value;
          new Button({
            text: isCurrent ? `\u2713 ${s.text}` : s.text,
            variant: isCurrent ? 'primary' : s.variant,
            block: true,
            size: 'sm',
            disabled: isCurrent,
            onClick: () => this._updateStatus(s.value)
          }).mount(btnGrid);
        }
        actionsCard.appendChild(btnGrid);

        // Делегировать
        new Button({
          text: '\u21C4 Делегировать', variant: 'secondary', block: true,
          onClick: () => this._openDelegateModal()
        }).mount(actionsCard);
      }

      if (actionsCard.children.length > 0) {
        sidebar.appendChild(actionsCard);
      }
    }

    // Info
    const infoCard = el('div', { class: 'ticket-detail__info' });
    const infoDl = el('dl');

    const addInfo = (label, value) => {
      infoDl.appendChild(el('dt', {}, label));
      if (typeof value === 'string') {
        infoDl.appendChild(el('dd', {}, value));
      } else {
        const dd = el('dd');
        dd.appendChild(value);
        infoDl.appendChild(dd);
      }
    };

    addInfo('Статус', new Badge(formatStatus(t.status), statusClass(t.status)).el);
    addInfo('Приоритет', new Badge(formatPriority(t.priority), priorityClass(t.priority)).el);
    addInfo('Автор', t.author?.displayName || '—');
    addInfo('Агент', t.assignee?.displayName || 'Не назначен');
    addInfo('Создано', formatDateTime(t.createdAt));
    if (t.updatedAt !== t.createdAt) {
      addInfo('Обновлено', formatDateTime(t.updatedAt));
    }
    if (t.closedAt) {
      addInfo('Закрыто', formatDateTime(t.closedAt));
    }

    if (t.readonly) {
      infoDl.appendChild(el('dt', { class: 'mt-md' }));
      infoDl.appendChild(el('dd', {}, new Badge('Только чтение', 'closed').el));
    }

    infoCard.appendChild(infoDl);
    sidebar.appendChild(infoCard);

    grid.appendChild(main);
    grid.appendChild(sidebar);
    this.content.appendChild(grid);
  }

  async _assignTicket() {
    try {
      const api = window.__api;
      const res = await api.put(`/tickets/${this.ticketId}/assign`);
      this.ticket = res.data;
      Toast.success(`Тикет взят в работу! Ваш псевдоним: ${res.data.agentAlias}`);
      this._renderDetail();
    } catch (err) {
      Toast.error(err.message);
    }
  }

  destroy() {
    if (this.chatWindow) this.chatWindow.destroy();
  }

  _openDelegateModal() {
    const modal = new DelegateModal({
      ticketId: this.ticketId,
      onDelegated: () => this._loadTicket()
    });
    modal.open();
  }

  async _updateStatus(status) {
    try {
      const api = window.__api;
      const res = await api.put(`/tickets/${this.ticketId}/status`, { status });
      this.ticket = res.data;
      Toast.success(`Статус изменён: ${formatStatus(status)}`);
      this._renderDetail();
    } catch (err) {
      Toast.error(err.message);
    }
  }
}
