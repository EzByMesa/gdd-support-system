import { el, clearEl } from '../utils/dom.js';
import { MainLayout } from '../components/layout/MainLayout.js';
import { Input } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { Select } from '../components/ui/Select.js';
import { FileUpload } from '../components/ui/FileUpload.js';
import { Toast } from '../components/ui/Toast.js';

export class NewTicketPage {
  constructor(router) {
    this.router = router;
  }

  render(container) {
    clearEl(container);

    const user = window.__auth.getUser();
    const layout = new MainLayout({ user, router: this.router, auth: window.__auth });
    layout.mount(container);

    const content = layout.getContent();

    // Header
    content.appendChild(el('div', { class: 'page-header' }, [
      el('h1', {}, 'Новое обращение'),
      new Button({
        text: '\u2190 Назад',
        variant: 'ghost',
        onClick: () => this.router.navigate('/')
      }).el
    ]));

    // Form card
    const card = el('div', { class: 'card' });
    const form = el('form', { class: 'flex-col gap-md' });

    const titleField = new Input({
      label: 'Тема обращения',
      name: 'title',
      required: true,
      placeholder: 'Кратко опишите проблему'
    });

    const descGroup = el('div', { class: 'input-group' });
    descGroup.appendChild(el('label', {}, 'Описание *'));
    const descTextarea = el('textarea', {
      class: 'textarea',
      name: 'description',
      placeholder: 'Подробно опишите вашу проблему или запрос...',
      rows: '6'
    });
    descGroup.appendChild(descTextarea);

    const prioritySelect = new Select({
      label: 'Приоритет',
      name: 'priority',
      value: 'MEDIUM',
      options: [
        { value: 'LOW', text: 'Низкий' },
        { value: 'MEDIUM', text: 'Средний' },
        { value: 'HIGH', text: 'Высокий' },
        { value: 'CRITICAL', text: 'Критичный' }
      ]
    });

    const fileUpload = new FileUpload({
      multiple: true,
      accept: 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.7z,.txt'
    });

    const attachLabel = el('div', { class: 'input-group' });
    attachLabel.appendChild(el('label', {}, 'Вложения'));
    fileUpload.mount(attachLabel);

    titleField.mount(form);
    form.appendChild(descGroup);
    prioritySelect.mount(form);
    form.appendChild(attachLabel);

    // Actions
    const actions = el('div', { class: 'flex justify-between mt-lg' });
    const cancelBtn = new Button({
      text: 'Отмена', variant: 'secondary',
      onClick: () => this.router.navigate('/')
    });
    const submitBtn = new Button({ text: 'Создать обращение', type: 'submit' });

    cancelBtn.mount(actions);
    submitBtn.mount(actions);
    form.appendChild(actions);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = titleField.getValue();
      const description = descTextarea.value;

      if (!title.trim()) { titleField.setError('Укажите тему'); return; }
      titleField.setError(null);
      if (!description.trim()) {
        descTextarea.classList.add('input--error');
        return;
      }
      descTextarea.classList.remove('input--error');

      submitBtn.setLoading(true);

      try {
        const api = window.__api;

        // Создаём тикет
        const result = await api.post('/tickets', {
          title,
          description,
          priority: prioritySelect.getValue()
        });

        const ticketId = result.data.id;

        // Загружаем вложения
        const files = fileUpload.getFiles();
        for (const file of files) {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('ticketId', ticketId);
          await api.upload('/attachments', fd);
        }

        Toast.success('Обращение создано!');
        this.router.navigate(`/tickets/${ticketId}`);
      } catch (err) {
        Toast.error(err.message || 'Ошибка создания');
        submitBtn.setLoading(false);
      }
    });

    card.appendChild(form);
    content.appendChild(card);
  }
}
