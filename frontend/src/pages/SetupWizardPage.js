import { el, clearEl } from '../utils/dom.js';
import { Stepper } from '../components/ui/Stepper.js';
import { Input } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { Toast } from '../components/ui/Toast.js';
import { Spinner } from '../components/ui/Spinner.js';
import { Select } from '../components/ui/Select.js';

const STEPS = ['База данных', 'Администратор', 'Хранилище', 'Готово'];

export class SetupWizardPage {
  constructor(router) {
    this.router = router;
    this.currentStep = 0;
    this.stepper = new Stepper(STEPS, 0);
    this.formContainer = el('div', { class: 'setup-step' });
    this.submitBtn = null;
  }

  async render(container) {
    clearEl(container);

    const page = el('div', { class: 'setup-page' });
    const card = el('div', { class: 'setup-card' });

    card.appendChild(el('h1', {}, 'Первоначальная настройка'));
    this.stepper.mount(card);
    card.appendChild(this.formContainer);

    page.appendChild(card);
    container.appendChild(page);

    // Проверяем текущий статус
    try {
      const res = await fetch('/api/setup/status');
      const { data } = await res.json();

      if (data.isComplete) {
        this.router.navigate('/login');
        return;
      }

      // Определяем текущий шаг на основе completedSteps
      const steps = data.completedSteps || [];
      if (steps.includes('storage')) this.currentStep = 3;
      else if (steps.includes('admin')) this.currentStep = 2;
      else if (steps.includes('database')) this.currentStep = 1;
      else this.currentStep = 0;

      this.stepper.setCurrent(this.currentStep);
      this._renderStep();
    } catch {
      this._renderStep();
    }
  }

  _renderStep() {
    clearEl(this.formContainer);

    switch (this.currentStep) {
      case 0: this._renderDatabaseStep(); break;
      case 1: this._renderAdminStep(); break;
      case 2: this._renderStorageStep(); break;
      case 3: this._renderCompleteStep(); break;
    }
  }

  // --- Шаг 1: База данных ---
  _renderDatabaseStep() {
    this.dbType = this.dbType || 'sqlite';

    this.formContainer.appendChild(el('h2', {}, 'Подключение к базе данных'));
    this.formContainer.appendChild(el('p', { class: 'text-secondary text-sm mb-md' },
      'Выберите тип базы данных и укажите параметры подключения'
    ));

    // Выбор типа БД
    const dbTypeSelect = new Select({
      label: 'Тип базы данных',
      name: 'dbType',
      value: this.dbType,
      options: [
        { value: 'sqlite', text: 'SQLite (файловая) — рекомендуется' },
        { value: 'postgres', text: 'PostgreSQL' }
      ],
      onChange: (val) => {
        this.dbType = val;
        this._renderStep(); // перерисовка формы
      }
    });
    dbTypeSelect.mount(this.formContainer);

    // Поля в зависимости от типа
    this.fieldsContainer = el('div', { class: 'flex-col gap-md mt-md' });
    this.formContainer.appendChild(this.fieldsContainer);

    let fields;

    if (this.dbType === 'sqlite') {
      this.fieldsContainer.appendChild(
        el('p', { class: 'text-muted text-xs mb-sm' }, 'Файл будет создан автоматически. SQLite подходит для небольших инсталляций.')
      );

      fields = {
        path: new Input({
          label: 'Путь к файлу базы данных',
          name: 'path',
          value: './data/gdd_support.sqlite',
          required: true,
          placeholder: '/path/to/database.sqlite'
        })
      };
    } else {
      fields = {
        host: new Input({ label: 'Хост', name: 'host', value: 'localhost', required: true }),
        port: new Input({ label: 'Порт', name: 'port', type: 'number', value: '5432' }),
        database: new Input({ label: 'Имя базы данных', name: 'database', value: 'gdd_support', required: true }),
        username: new Input({ label: 'Пользователь', name: 'username', value: 'postgres', required: true }),
        password: new Input({ label: 'Пароль', name: 'password', type: 'password' })
      };
    }

    for (const field of Object.values(fields)) {
      field.mount(this.fieldsContainer);
    }

    const actions = el('div', { class: 'setup-actions' });

    if (this.dbType === 'postgres') {
      const testBtn = new Button({
        text: 'Проверить подключение',
        variant: 'secondary',
        onClick: () => this._submitDatabase(fields, testBtn, true)
      });
      testBtn.mount(actions);
    }

    this.submitBtn = new Button({
      text: 'Далее \u2192',
      onClick: () => this._submitDatabase(fields, this.submitBtn, false)
    });
    this.submitBtn.mount(actions);
    this.formContainer.appendChild(actions);
  }

  async _submitDatabase(fields, btn, testOnly) {
    btn.setLoading(true);

    let body;
    if (this.dbType === 'sqlite') {
      body = { dbType: 'sqlite', path: fields.path.getValue() };
    } else {
      body = {
        dbType: 'postgres',
        host: fields.host.getValue(),
        port: parseInt(fields.port.getValue()) || 5432,
        database: fields.database.getValue(),
        username: fields.username.getValue(),
        password: fields.password.getValue()
      };
    }

    try {
      const res = await fetch('/api/setup/step/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        Toast.error(data.error?.message || 'Ошибка подключения');
        btn.setLoading(false);
        return;
      }

      if (testOnly) {
        Toast.success('Подключение успешно!');
        btn.setLoading(false);
        return;
      }

      Toast.success(data.data.message);
      this.currentStep = 1;
      this.stepper.setCurrent(1);
      this._renderStep();
    } catch (err) {
      Toast.error('Ошибка сети');
      btn.setLoading(false);
    }
  }

  // --- Шаг 2: Администратор ---
  _renderAdminStep() {
    this.formContainer.appendChild(el('h2', {}, 'Корневой администратор'));
    this.formContainer.appendChild(el('p', { class: 'text-secondary text-sm mb-md' },
      'Создайте учётную запись главного администратора системы'
    ));

    const fields = {
      login: new Input({ label: 'Логин', name: 'login', required: true, placeholder: 'admin' }),
      email: new Input({ label: 'Email', name: 'email', type: 'email', placeholder: 'admin@company.com' }),
      displayName: new Input({ label: 'Отображаемое имя', name: 'displayName', required: true, placeholder: 'Администратор' }),
      password: new Input({ label: 'Пароль', name: 'password', type: 'password', required: true, placeholder: 'Минимум 8 символов' }),
      passwordConfirm: new Input({ label: 'Подтверждение пароля', name: 'passwordConfirm', type: 'password', required: true })
    };

    for (const field of Object.values(fields)) {
      field.mount(this.formContainer);
    }

    const actions = el('div', { class: 'setup-actions' });
    this.submitBtn = new Button({
      text: 'Далее \u2192',
      onClick: () => this._submitAdmin(fields)
    });
    this.submitBtn.mount(actions);
    this.formContainer.appendChild(actions);
  }

  async _submitAdmin(fields) {
    // Валидация
    const password = fields.password.getValue();
    const confirm = fields.passwordConfirm.getValue();

    if (password !== confirm) {
      fields.passwordConfirm.setError('Пароли не совпадают');
      return;
    }
    fields.passwordConfirm.setError(null);

    if (password.length < 8) {
      fields.password.setError('Минимум 8 символов');
      return;
    }
    fields.password.setError(null);

    this.submitBtn.setLoading(true);

    try {
      const res = await fetch('/api/setup/step/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: fields.login.getValue(),
          email: fields.email.getValue(),
          displayName: fields.displayName.getValue(),
          password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        Toast.error(data.error?.message || 'Ошибка');
        this.submitBtn.setLoading(false);
        return;
      }

      Toast.success(data.data.message);
      this.currentStep = 2;
      this.stepper.setCurrent(2);
      this._renderStep();
    } catch {
      Toast.error('Ошибка сети');
      this.submitBtn.setLoading(false);
    }
  }

  // --- Шаг 3: Хранилище ---
  _renderStorageStep() {
    this.formContainer.appendChild(el('h2', {}, 'Хранилище вложений'));
    this.formContainer.appendChild(el('p', { class: 'text-secondary text-sm mb-md' },
      'Укажите путь к папке на сервере для хранения зашифрованных вложений'
    ));

    const storageField = new Input({
      label: 'Путь к папке',
      name: 'storagePath',
      required: true,
      placeholder: '/var/gdd_support/attachments'
    });
    storageField.mount(this.formContainer);

    this.formContainer.appendChild(el('p', { class: 'text-muted text-xs mt-sm' },
      'Папка будет создана автоматически, если не существует. Файлы хранятся в зашифрованном виде без расширений.'
    ));

    const actions = el('div', { class: 'setup-actions' });
    this.submitBtn = new Button({
      text: 'Далее \u2192',
      onClick: () => this._submitStorage(storageField)
    });
    this.submitBtn.mount(actions);
    this.formContainer.appendChild(actions);
  }

  async _submitStorage(field) {
    const storagePath = field.getValue();
    if (!storagePath.trim()) {
      field.setError('Укажите путь');
      return;
    }
    field.setError(null);

    this.submitBtn.setLoading(true);

    try {
      const res = await fetch('/api/setup/step/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath })
      });

      const data = await res.json();

      if (!res.ok) {
        Toast.error(data.error?.message || 'Ошибка');
        this.submitBtn.setLoading(false);
        return;
      }

      Toast.success(data.data.message);
      this.currentStep = 3;
      this.stepper.setCurrent(3);
      this._renderStep();
    } catch {
      Toast.error('Ошибка сети');
      this.submitBtn.setLoading(false);
    }
  }

  // --- Шаг 4: Завершение ---
  _renderCompleteStep() {
    this.formContainer.appendChild(el('div', { class: 'text-center', style: { padding: 'var(--space-xl) 0' } }, [
      el('div', { style: { fontSize: '48px', marginBottom: 'var(--space-md)' } }, '\u2705'),
      el('h2', {}, 'Всё готово!'),
      el('p', { class: 'text-secondary mt-sm' },
        'Система настроена. Нажмите кнопку ниже для завершения и входа в систему.'
      )
    ]));

    const actions = el('div', { class: 'setup-actions justify-center' });
    this.submitBtn = new Button({
      text: 'Завершить настройку',
      size: 'lg',
      onClick: () => this._submitComplete()
    });
    this.submitBtn.mount(actions);
    this.formContainer.appendChild(actions);
  }

  async _submitComplete() {
    this.submitBtn.setLoading(true);

    try {
      const res = await fetch('/api/setup/step/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();

      if (!res.ok) {
        Toast.error(data.error?.message || 'Ошибка');
        this.submitBtn.setLoading(false);
        return;
      }

      // Автологин
      const { accessToken, user } = data.data;
      if (accessToken && window.__auth) {
        window.__auth.api.setToken(accessToken);
        window.__auth.user = user;
      }

      Toast.success('Настройка завершена! Добро пожаловать!');

      setTimeout(() => {
        this.router.navigate('/');
      }, 1000);
    } catch {
      Toast.error('Ошибка сети');
      this.submitBtn.setLoading(false);
    }
  }
}
