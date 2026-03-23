import { el, clearEl } from '../../utils/dom.js';
import { AdminLayout } from '../../components/layout/AdminLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { Badge } from '../../components/ui/Badge.js';
import { Modal } from '../../components/ui/Modal.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { Toast } from '../../components/ui/Toast.js';
import { formatDateTime } from '../../utils/format.js';

export class AdminUsersPage {
  constructor(router) {
    this.router = router;
    this.users = [];
    this.page = 1;
    this.search = '';
    this.roleFilter = '';
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

    this.content.appendChild(el('div', { class: 'page-header' }, [
      el('h1', {}, 'Пользователи'),
      new Button({ text: '+ Создать', onClick: () => this._openCreateModal() }).el
    ]));

    // Filters
    const filters = el('div', { class: 'admin-table-actions' });

    const searchInput = new Input({
      placeholder: 'Поиск по имени, логину, email...',
      onInput: (val) => { this.search = val; this.page = 1; this._load(); }
    });
    searchInput.el.className = 'admin-table-actions__search';
    filters.appendChild(searchInput.el);

    new Select({
      placeholder: 'Все роли',
      options: [
        { value: '', text: 'Все роли' },
        { value: 'USER', text: 'Пользователь' },
        { value: 'AGENT', text: 'Агент' },
        { value: 'ADMIN', text: 'Администратор' }
      ],
      onChange: (val) => { this.roleFilter = val; this.page = 1; this._load(); }
    }).mount(filters);

    this.content.appendChild(filters);

    this.listEl = el('div', { class: 'flex-col gap-xs' });
    this.content.appendChild(this.listEl);
  }

  async _load() {
    clearEl(this.listEl);
    new Spinner().mount(this.listEl);

    try {
      const query = { page: this.page, limit: 20 };
      if (this.search) query.search = this.search;
      if (this.roleFilter) query.role = this.roleFilter;

      const res = await window.__api.get('/admin/users', query);
      this.users = res.data || [];
      this._renderUsers();
    } catch (err) {
      clearEl(this.listEl);
      Toast.error(err.message);
    }
  }

  _renderUsers() {
    clearEl(this.listEl);

    if (this.users.length === 0) {
      this.listEl.appendChild(el('div', { class: 'empty-state' }, [
        el('div', { class: 'empty-state__title' }, 'Нет пользователей')
      ]));
      return;
    }

    for (const user of this.users) {
      this.listEl.appendChild(this._renderUserCard(user));
    }
  }

  _renderUserCard(u) {
    const roleBadges = {
      ADMIN: 'in-progress',
      AGENT: 'open',
      USER: 'closed'
    };
    const roleLabels = { ADMIN: 'Администратор', AGENT: 'Агент', USER: 'Пользователь' };

    const card = el('div', { class: 'card flex items-center justify-between gap-md', style: { padding: 'var(--space-md) var(--space-lg)' } });

    // Info
    const info = el('div', { class: 'flex items-center gap-md', style: { flex: '1' } }, [
      el('div', { class: 'header__avatar' }, u.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()),
      el('div', { class: 'flex-col' }, [
        el('div', { style: { fontWeight: 'var(--font-weight-medium)' } }, [
          u.displayName,
          u.isRootAdmin ? el('span', { class: 'text-xs text-muted', style: { marginLeft: '4px' } }, '(root)') : null
        ].filter(Boolean)),
        el('div', { class: 'text-xs text-muted' }, `@${u.login}${u.email ? ` \u00B7 ${u.email}` : ''}`),
      ])
    ]);

    // Badges
    const badges = el('div', { class: 'flex gap-xs items-center' }, [
      new Badge(roleLabels[u.role], roleBadges[u.role]).el,
      !u.isActive ? new Badge('Неактивен', 'closed').el : null
    ].filter(Boolean));

    // Actions
    const actions = el('div', { class: 'flex gap-xs' });

    const roleSelect = new Select({
      value: u.role,
      options: [
        { value: 'USER', text: 'Пользователь' },
        { value: 'AGENT', text: 'Агент' },
        { value: 'ADMIN', text: 'Администратор' }
      ],
      onChange: (val) => this._changeRole(u.id, val)
    });
    roleSelect.select.style.minHeight = '34px';
    roleSelect.select.style.padding = '4px 30px 4px 10px';
    roleSelect.select.style.fontSize = 'var(--font-size-xs)';
    actions.appendChild(roleSelect.select);

    const toggleBtn = new Button({
      text: u.isActive ? 'Откл' : 'Вкл',
      variant: u.isActive ? 'ghost' : 'primary',
      size: 'sm',
      onClick: () => this._toggleActive(u.id, !u.isActive)
    });
    toggleBtn.mount(actions);

    card.appendChild(info);
    card.appendChild(badges);
    card.appendChild(actions);
    return card;
  }

  async _changeRole(userId, role) {
    try {
      await window.__api.put(`/admin/users/${userId}/role`, { role });
      Toast.success('Роль изменена');
      await this._load();
    } catch (err) { Toast.error(err.message); }
  }

  async _toggleActive(userId, isActive) {
    try {
      await window.__api.put(`/admin/users/${userId}/active`, { isActive });
      Toast.success(isActive ? 'Активирован' : 'Деактивирован');
      await this._load();
    } catch (err) { Toast.error(err.message); }
  }

  _openCreateModal() {
    const modal = new Modal({ title: 'Создать пользователя' });
    const body = modal.getBody();
    const footer = modal.getFooter();

    const form = el('div', { class: 'flex-col gap-md' });
    const fields = {
      login: new Input({ label: 'Логин', required: true }),
      displayName: new Input({ label: 'Имя', required: true }),
      email: new Input({ label: 'Email', type: 'email' }),
      password: new Input({ label: 'Пароль', type: 'password', required: true }),
      role: new Select({
        label: 'Роль', value: 'USER',
        options: [
          { value: 'USER', text: 'Пользователь' },
          { value: 'AGENT', text: 'Агент' },
          { value: 'ADMIN', text: 'Администратор' }
        ]
      })
    };

    for (const f of Object.values(fields)) f.mount(form);
    body.appendChild(form);

    new Button({ text: 'Отмена', variant: 'secondary', onClick: () => modal.close() }).mount(footer);

    const saveBtn = new Button({
      text: 'Создать',
      onClick: async () => {
        saveBtn.setLoading(true);
        try {
          await window.__api.post('/admin/users', {
            login: fields.login.getValue(),
            displayName: fields.displayName.getValue(),
            email: fields.email.getValue(),
            password: fields.password.getValue(),
            role: fields.role.getValue()
          });
          Toast.success('Пользователь создан');
          modal.close();
          await this._load();
        } catch (err) {
          Toast.error(err.message);
          saveBtn.setLoading(false);
        }
      }
    });
    saveBtn.mount(footer);

    modal.open();
  }
}
