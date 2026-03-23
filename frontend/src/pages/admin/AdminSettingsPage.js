import { el, clearEl } from '../../utils/dom.js';
import { AdminLayout } from '../../components/layout/AdminLayout.js';
import { Input } from '../../components/ui/Input.js';
import { Button } from '../../components/ui/Button.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { Toast } from '../../components/ui/Toast.js';

const SETTINGS_SCHEMA = [
  { section: 'Регистрация', items: [
    { key: 'registration.enabled', label: 'Регистрация пользователей', desc: 'Разрешить самостоятельную регистрацию', type: 'toggle' }
  ]},
  { section: 'Хранилище', items: [
    { key: 'storage.maxFileSize', label: 'Макс. размер файла (байт)', desc: 'По умолчанию 50 МБ', type: 'number' },
    { key: 'storage.path', label: 'Путь к хранилищу', desc: 'Папка для зашифрованных вложений', type: 'text', readonly: true }
  ]},
  { section: 'Тикеты', items: [
    { key: 'tickets.autoCloseAfterDays', label: 'Автозакрытие (дней)', desc: 'Автозакрытие resolved тикетов', type: 'number' }
  ]},
  { section: 'ML-группировка', items: [
    { key: 'grouping.similarityThreshold', label: 'Порог сходства', desc: 'От 0 до 1, по умолчанию 0.75', type: 'number' }
  ]},
  { section: 'Приложение', items: [
    { key: 'app.name', label: 'Название системы', type: 'text' }
  ]}
];

export class AdminSettingsPage {
  constructor(router) { this.router = router; }

  async render(container) {
    clearEl(container);

    const user = window.__auth.getUser();
    const layout = new AdminLayout({ user, router: this.router, auth: window.__auth });
    layout.mount(container);

    this.content = layout.getContent();
    new Spinner().mount(this.content);

    try {
      const res = await window.__api.get('/admin/settings');
      this.settings = res.data;
      this._renderSettings();
    } catch (err) {
      clearEl(this.content);
      Toast.error(err.message);
    }
  }

  _renderSettings() {
    clearEl(this.content);
    this.content.appendChild(el('div', { class: 'page-header' }, [el('h1', {}, 'Системные настройки')]));

    for (const section of SETTINGS_SCHEMA) {
      const card = el('div', { class: 'settings-section' });
      card.appendChild(el('div', { class: 'settings-section__title' }, section.section));

      for (const item of section.items) {
        const value = this.settings[item.key];
        card.appendChild(this._renderSettingRow(item, value));
      }

      this.content.appendChild(card);
    }
  }

  _renderSettingRow(item, value) {
    const row = el('div', { class: 'settings-row' });

    const label = el('div', { class: 'settings-row__label' }, [
      el('div', { class: 'settings-row__name' }, item.label),
      item.desc ? el('div', { class: 'settings-row__description' }, item.desc) : null
    ].filter(Boolean));
    row.appendChild(label);

    if (item.type === 'toggle') {
      const toggle = el('label', { class: 'toggle' });
      const input = el('input', { type: 'checkbox' });
      input.checked = !!value;
      input.addEventListener('change', () => this._saveSetting(item.key, input.checked));
      toggle.appendChild(input);
      toggle.appendChild(el('span', { class: 'toggle__slider' }));
      row.appendChild(toggle);
    } else {
      const input = el('input', {
        class: 'input',
        type: item.type === 'number' ? 'number' : 'text',
        value: value != null ? String(value) : '',
        style: { maxWidth: '200px', minHeight: '36px' }
      });
      if (item.readonly) input.readOnly = true;

      let saveTimer;
      input.addEventListener('input', () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          const val = item.type === 'number' ? parseFloat(input.value) : input.value;
          this._saveSetting(item.key, val);
        }, 800);
      });

      row.appendChild(input);
    }

    return row;
  }

  async _saveSetting(key, value) {
    try {
      await window.__api.put(`/admin/settings/${key}`, { value });
      this.settings[key] = value;
      Toast.success('Сохранено');
    } catch (err) {
      Toast.error(err.message);
    }
  }
}
