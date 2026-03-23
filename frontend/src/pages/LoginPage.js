import { el, clearEl } from '../utils/dom.js';
import { Input } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { Toast } from '../components/ui/Toast.js';
import { Spinner } from '../components/ui/Spinner.js';

export class LoginPage {
  constructor(router) {
    this.router = router;
    this.providers = [];
    this.mode = 'local'; // 'local' | '1c'
  }

  async render(container) {
    clearEl(container);

    const page = el('div', { class: 'auth-page' });
    this.card = el('div', { class: 'auth-card' });

    // Logo
    this.card.appendChild(el('div', { class: 'auth-card__logo' }, [
      el('h1', {}, 'GDD Support'),
      el('p', {}, 'Вход в систему')
    ]));

    page.appendChild(this.card);
    container.appendChild(page);

    // Загружаем провайдеры
    await this._loadProviders();
    this._renderForm();
  }

  async _loadProviders() {
    try {
      const res = await fetch('/api/auth/providers');
      if (res.ok) {
        const { data } = await res.json();
        this.providers = data || [];
      }
    } catch {
      this.providers = [{ type: 'LOCAL', name: 'Логин и пароль' }];
    }
  }

  _renderForm() {
    // Удаляем старую форму если есть
    const oldForm = this.card.querySelector('.auth-form');
    if (oldForm) oldForm.remove();
    const oldProviders = this.card.querySelector('.auth-providers');
    if (oldProviders) oldProviders.remove();
    const oldFooter = this.card.querySelector('.auth-form__footer');
    if (oldFooter) oldFooter.remove();

    if (this.mode === 'local') {
      this._renderLocalForm();
    } else {
      this._renderOneCForm();
    }

    // Провайдеры (если 1С доступен)
    const hasOneC = this.providers.some(p => p.type === 'ONE_C');
    if (hasOneC) {
      const providersBlock = el('div', { class: 'auth-providers' });

      providersBlock.appendChild(
        el('div', { class: 'auth-providers__divider' }, 'или')
      );

      if (this.mode === 'local') {
        const oneCProvider = this.providers.find(p => p.type === 'ONE_C');
        providersBlock.appendChild(
          new Button({
            text: `Войти через ${oneCProvider?.name || '1С'}`,
            variant: 'secondary',
            block: true,
            onClick: () => { this.mode = '1c'; this._renderForm(); }
          }).el
        );
      } else {
        providersBlock.appendChild(
          new Button({
            text: 'Войти по логину и паролю',
            variant: 'secondary',
            block: true,
            onClick: () => { this.mode = 'local'; this._renderForm(); }
          }).el
        );
      }

      this.card.appendChild(providersBlock);
    }

    // Ссылка на регистрацию
    const footer = el('div', { class: 'auth-form__footer' });
    footer.innerHTML = 'Нет аккаунта? <a href="#/register">Зарегистрироваться</a>';
    this.card.appendChild(footer);
  }

  _renderLocalForm() {
    const form = el('form', { class: 'auth-form' });

    const loginField = new Input({
      label: 'Логин', name: 'login', required: true, placeholder: 'Ваш логин'
    });
    const passwordField = new Input({
      label: 'Пароль', name: 'password', type: 'password', required: true
    });

    loginField.mount(form);
    passwordField.mount(form);

    const submitBtn = new Button({
      text: 'Войти', variant: 'primary', block: true, type: 'submit'
    });
    submitBtn.mount(form);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      submitBtn.setLoading(true);

      try {
        const auth = window.__auth;
        await auth.login(loginField.getValue(), passwordField.getValue());
        this.router.navigate('/');
      } catch (err) {
        Toast.error(err.message || 'Ошибка входа');
        submitBtn.setLoading(false);
      }
    });

    this.card.appendChild(form);
  }

  _renderOneCForm() {
    const form = el('form', { class: 'auth-form' });

    const oneCProvider = this.providers.find(p => p.type === 'ONE_C');

    form.appendChild(
      el('p', { class: 'text-center text-secondary text-sm mb-md' },
        `Вход через ${oneCProvider?.name || '1С'}`
      )
    );

    const loginField = new Input({
      label: 'Логин 1С', name: 'login_1c', required: true, placeholder: 'Логин в 1С'
    });
    const passwordField = new Input({
      label: 'Пароль 1С', name: 'password_1c', type: 'password', required: true
    });

    loginField.mount(form);
    passwordField.mount(form);

    const submitBtn = new Button({
      text: 'Войти через 1С', variant: 'primary', block: true, type: 'submit'
    });
    submitBtn.mount(form);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      submitBtn.setLoading(true);

      try {
        const auth = window.__auth;
        await auth.loginOneC(loginField.getValue(), passwordField.getValue());
        this.router.navigate('/');
      } catch (err) {
        Toast.error(err.message || 'Ошибка входа через 1С');
        submitBtn.setLoading(false);
      }
    });

    this.card.appendChild(form);
  }
}
