import { el } from '../../utils/dom.js';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { Select } from '../ui/Select.js';
import { Toast } from '../ui/Toast.js';

export class DelegateModal {
  /**
   * @param {object} opts
   * @param {string} opts.ticketId
   * @param {Function} opts.onDelegated
   */
  constructor({ ticketId, onDelegated }) {
    this.ticketId = ticketId;
    this.onDelegated = onDelegated;
    this.agents = [];
    this.modal = new Modal({ title: 'Делегировать тикет' });
  }

  async open() {
    const body = this.modal.getBody();
    const footer = this.modal.getFooter();

    body.innerHTML = '<div class="spinner-container"><div class="spinner"></div></div>';
    this.modal.open();

    // Загружаем список агентов
    try {
      const api = window.__api;
      // Используем admin endpoint если доступен, иначе простой список
      const res = await api.get('/admin/users', { role: 'AGENT', limit: 100 });
      this.agents = res.data || [];
    } catch {
      // Fallback — попробуем получить агентов другим путём
      try {
        const res = await api.get('/admin/users', { limit: 100 });
        this.agents = (res.data || []).filter(u =>
          (u.role === 'AGENT' || u.role === 'ADMIN') && u.id !== window.__auth.getUser().id
        );
      } catch {
        this.agents = [];
      }
    }

    body.innerHTML = '';

    if (this.agents.length === 0) {
      body.appendChild(el('p', { class: 'text-muted text-center' }, 'Нет доступных агентов для делегирования'));
      footer.appendChild(new Button({ text: 'Закрыть', variant: 'secondary', onClick: () => this.modal.close() }).el);
      return;
    }

    const currentUserId = window.__auth.getUser().id;
    const filteredAgents = this.agents.filter(a => a.id !== currentUserId);

    const agentSelect = new Select({
      label: 'Выберите агента',
      name: 'agent',
      placeholder: 'Выберите...',
      options: filteredAgents.map(a => ({
        value: a.id,
        text: `${a.displayName} (${a.role === 'ADMIN' ? 'Администратор' : 'Агент'})`
      }))
    });
    agentSelect.mount(body);

    // Причина
    const reasonGroup = el('div', { class: 'input-group mt-md' });
    reasonGroup.appendChild(el('label', {}, 'Причина (необязательно)'));
    const reasonInput = el('textarea', {
      class: 'textarea',
      placeholder: 'Почему вы хотите передать этот тикет?',
      rows: '3'
    });
    reasonGroup.appendChild(reasonInput);
    body.appendChild(reasonGroup);

    // Кнопки
    const cancelBtn = new Button({
      text: 'Отмена', variant: 'secondary',
      onClick: () => this.modal.close()
    });
    const submitBtn = new Button({
      text: 'Отправить запрос',
      onClick: () => this._submit(agentSelect, reasonInput, submitBtn)
    });

    cancelBtn.mount(footer);
    submitBtn.mount(footer);
  }

  async _submit(agentSelect, reasonInput, submitBtn) {
    const toAgentId = agentSelect.getValue();
    if (!toAgentId) {
      Toast.warning('Выберите агента');
      return;
    }

    submitBtn.setLoading(true);

    try {
      const api = window.__api;
      await api.post(`/tickets/${this.ticketId}/delegate`, {
        toAgentId,
        message: reasonInput.value.trim() || null
      });

      Toast.success('Запрос на делегирование отправлен');
      this.modal.close();
      if (this.onDelegated) this.onDelegated();
    } catch (err) {
      Toast.error(err.message || 'Ошибка делегирования');
      submitBtn.setLoading(false);
    }
  }
}
