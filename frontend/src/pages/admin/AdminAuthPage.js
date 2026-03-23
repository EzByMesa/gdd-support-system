import { el, clearEl } from '../../utils/dom.js';
import { AdminLayout } from '../../components/layout/AdminLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { Modal } from '../../components/ui/Modal.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { Toast } from '../../components/ui/Toast.js';

export class AdminAuthPage {
  constructor(router) { this.router = router; }

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
      el('h1', {}, 'Авторизация'),
      new Button({ text: '+ Добавить провайдер', onClick: () => this._openAddModal() }).el
    ]));

    // Registration toggle
    this.regSection = el('div', { class: 'settings-section mb-lg' });
    this.content.appendChild(this.regSection);

    // Providers list
    this.content.appendChild(el('h2', { class: 'mb-md' }, 'Провайдеры авторизации'));
    this.listEl = el('div', { class: 'flex-col gap-sm' });
    this.content.appendChild(this.listEl);
  }

  async _load() {
    // Registration setting
    try {
      const settings = await window.__api.get('/admin/settings');
      const regEnabled = settings.data['registration.enabled'];

      clearEl(this.regSection);
      this.regSection.appendChild(el('div', { class: 'settings-section__title' }, 'Регистрация'));

      const row = el('div', { class: 'settings-row' });
      row.appendChild(el('div', { class: 'settings-row__label' }, [
        el('div', { class: 'settings-row__name' }, 'Самостоятельная регистрация'),
        el('div', { class: 'settings-row__description' }, 'Если выключено — только админ может создавать пользователей')
      ]));

      const toggle = el('label', { class: 'toggle' });
      const input = el('input', { type: 'checkbox' });
      input.checked = regEnabled !== false;
      input.addEventListener('change', async () => {
        await window.__api.put('/admin/settings/registration.enabled', { value: input.checked });
        Toast.success(input.checked ? 'Регистрация включена' : 'Регистрация отключена');
      });
      toggle.appendChild(input);
      toggle.appendChild(el('span', { class: 'toggle__slider' }));
      row.appendChild(toggle);

      this.regSection.appendChild(row);
    } catch {}

    // Providers
    clearEl(this.listEl);
    try {
      const res = await window.__api.get('/admin/auth-providers');
      const providers = res.data || [];

      if (providers.length === 0) {
        this.listEl.appendChild(el('p', { class: 'text-muted' }, 'Нет настроенных провайдеров (используется локальная авторизация)'));
      }

      for (const p of providers) {
        this.listEl.appendChild(this._renderProvider(p));
      }
    } catch (err) {
      Toast.error(err.message);
    }
  }

  _renderProvider(p) {
    const card = el('div', { class: 'provider-card' });

    const info = el('div', { class: 'provider-card__info' }, [
      el('div', { class: 'provider-card__icon' }, p.type === 'ONE_C' ? '1\u0421' : '\uD83D\uDD12'),
      el('div', {}, [
        el('div', { class: 'provider-card__name' }, p.name),
        el('div', { class: 'provider-card__type' }, p.type === 'ONE_C' ? '1С:Предприятие' : 'Локальный')
      ])
    ]);

    const actions = el('div', { class: 'provider-card__actions' });

    if (p.type === 'ONE_C') {
      new Button({
        text: 'Тест', variant: 'secondary', size: 'sm',
        onClick: async () => {
          const res = await window.__api.post(`/admin/auth-providers/${p.id}/test`);
          if (res.data.success) Toast.success(res.data.message);
          else Toast.error(res.data.message);
        }
      }).mount(actions);
    }

    const toggleBtn = new Button({
      text: p.isActive ? 'Откл' : 'Вкл',
      variant: p.isActive ? 'ghost' : 'primary', size: 'sm',
      onClick: async () => {
        await window.__api.put(`/admin/auth-providers/${p.id}`, { isActive: !p.isActive });
        Toast.success(p.isActive ? 'Отключён' : 'Включён');
        await this._load();
      }
    });
    toggleBtn.mount(actions);

    new Button({
      text: '\u00D7', variant: 'danger', size: 'sm',
      onClick: async () => {
        if (confirm('Удалить провайдер?')) {
          await window.__api.delete(`/admin/auth-providers/${p.id}`);
          Toast.success('Удалён');
          await this._load();
        }
      }
    }).mount(actions);

    card.appendChild(info);
    card.appendChild(actions);
    return card;
  }

  _openAddModal() {
    const modal = new Modal({ title: 'Добавить провайдер' });
    const body = modal.getBody();
    const footer = modal.getFooter();

    const form = el('div', { class: 'flex-col gap-md' });

    const typeSelect = new Select({
      label: 'Тип', value: 'ONE_C',
      options: [{ value: 'ONE_C', text: '1С:Предприятие' }]
    });
    typeSelect.mount(form);

    const nameField = new Input({ label: 'Название', value: '1С:Предприятие', required: true });
    nameField.mount(form);

    form.appendChild(el('div', { class: 'divider' }));
    form.appendChild(el('h3', { style: { fontSize: 'var(--font-size-sm)' } }, 'Настройки подключения к 1С'));

    const baseUrlField = new Input({ label: 'URL сервера 1С', placeholder: 'http://1c-server:8080/erp', required: true });
    baseUrlField.mount(form);

    const endpointField = new Input({ label: 'Эндпоинт авторизации', value: '/auth/validate' });
    endpointField.mount(form);

    const timeoutField = new Input({ label: 'Таймаут (мс)', type: 'number', value: '5000' });
    timeoutField.mount(form);

    body.appendChild(form);

    new Button({ text: 'Отмена', variant: 'secondary', onClick: () => modal.close() }).mount(footer);
    const saveBtn = new Button({
      text: 'Добавить',
      onClick: async () => {
        saveBtn.setLoading(true);
        try {
          await window.__api.post('/admin/auth-providers', {
            type: 'ONE_C',
            name: nameField.getValue(),
            config: {
              baseUrl: baseUrlField.getValue(),
              authEndpoint: endpointField.getValue(),
              timeout: parseInt(timeoutField.getValue()) || 5000,
              defaultRole: 'USER'
            }
          });
          Toast.success('Провайдер добавлен');
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
