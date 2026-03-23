import { el, clearEl } from '../../utils/dom.js';
import { AdminLayout } from '../../components/layout/AdminLayout.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { Badge } from '../../components/ui/Badge.js';
import { formatDateTime, formatStatus, statusClass } from '../../utils/format.js';

export class AdminDashboardPage {
  constructor(router) { this.router = router; }

  async render(container) {
    clearEl(container);

    const user = window.__auth.getUser();
    const layout = new AdminLayout({ user, router: this.router, auth: window.__auth });
    layout.mount(container);

    const content = layout.getContent();
    new Spinner().mount(content);

    try {
      const api = window.__api;
      const res = await api.get('/admin/dashboard');
      const { stats, recentTickets } = res.data;

      clearEl(content);

      content.appendChild(el('div', { class: 'page-header' }, [el('h1', {}, 'Дашборд')]));

      // Stats
      const grid = el('div', { class: 'stats-grid' });

      const cards = [
        { label: 'Всего тикетов', value: stats.totalTickets, color: '' },
        { label: 'Открытых', value: stats.openTickets, color: 'var(--color-status-open)' },
        { label: 'В работе', value: stats.inProgressTickets, color: 'var(--color-status-in-progress)' },
        { label: 'Решённых', value: stats.resolvedTickets, color: 'var(--color-status-resolved)' },
        { label: 'Пользователей', value: stats.totalUsers, color: '' },
        { label: 'Агентов/Админов', value: stats.totalAgents, color: '' },
        { label: 'Тем. групп', value: stats.totalGroups, color: '' }
      ];

      for (const c of cards) {
        const card = el('div', { class: 'stat-card' });
        card.appendChild(el('div', { class: 'stat-card__label' }, c.label));
        const val = el('div', { class: 'stat-card__value' }, String(c.value));
        if (c.color) val.style.color = c.color;
        card.appendChild(val);
        grid.appendChild(card);
      }

      content.appendChild(grid);

      // Recent tickets
      content.appendChild(el('h2', { class: 'mt-lg mb-md' }, 'Последние тикеты'));

      if (recentTickets.length === 0) {
        content.appendChild(el('p', { class: 'text-muted' }, 'Нет тикетов'));
      } else {
        const list = el('div', { class: 'flex-col gap-xs' });
        for (const t of recentTickets) {
          const row = el('a', {
            href: `#/tickets/${t.id}`,
            class: 'card card--hoverable flex items-center justify-between',
            style: { padding: 'var(--space-sm) var(--space-md)' }
          }, [
            el('div', { class: 'flex items-center gap-md' }, [
              el('span', { class: 'text-muted text-xs' }, `#${t.number}`),
              el('span', { style: { fontSize: 'var(--font-size-sm)' } }, t.title)
            ]),
            el('div', { class: 'flex items-center gap-sm' }, [
              new Badge(formatStatus(t.status), statusClass(t.status)).el,
              el('span', { class: 'text-muted text-xs' }, formatDateTime(t.createdAt))
            ])
          ]);
          list.appendChild(row);
        }
        content.appendChild(list);
      }
    } catch (err) {
      clearEl(content);
      content.appendChild(el('p', { class: 'text-danger' }, `Ошибка: ${err.message}`));
    }
  }
}
