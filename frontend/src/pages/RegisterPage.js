import { el, clearEl } from '../utils/dom.js';
import { Input } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { Toast } from '../components/ui/Toast.js';
import { validateLogin, validatePassword, validateEmail } from '../utils/validate.js';

export class RegisterPage {
  constructor(router) {
    this.router = router;
  }

  render(container) {
    clearEl(container);

    const page = el('div', { class: 'auth-page' });
    const card = el('div', { class: 'auth-card' });

    // Logo
    card.appendChild(el('div', { class: 'auth-card__logo' }, [
      el('h1', {}, 'GDD Support'),
      el('p', {}, 'Регистрация')
    ]));

    const form = el('form', { class: 'auth-form' });

    const fields = {
      displayName: new Input({
        label: 'Имя', name: 'displayName', required: true, placeholder: 'Как к вам обращаться'
      }),
      login: new Input({
        label: 'Логин', name: 'login', required: true, placeholder: 'Латиница, цифры, _ . -'
      }),
      email: new Input({
        label: 'Email', name: 'email', type: 'email', placeholder: 'name@company.com'
      }),
      password: new Input({
        label: 'Пароль', name: 'password', type: 'password', required: true, placeholder: 'Минимум 8 символов'
      }),
      passwordConfirm: new Input({
        label: 'Подтверждение пароля', name: 'passwordConfirm', type: 'password', required: true
      })
    };

    for (const field of Object.values(fields)) {
      field.mount(form);
    }

    const submitBtn = new Button({
      text: 'Зарегистрироваться', variant: 'primary', block: true, type: 'submit'
    });
    submitBtn.mount(form);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Валидация
      let hasErrors = false;

      const loginErr = validateLogin(fields.login.getValue());
      fields.login.setError(loginErr);
      if (loginErr) hasErrors = true;

      const passErr = validatePassword(fields.password.getValue());
      fields.password.setError(passErr);
      if (passErr) hasErrors = true;

      const emailErr = validateEmail(fields.email.getValue());
      fields.email.setError(emailErr);
      if (emailErr) hasErrors = true;

      if (!fields.displayName.getValue().trim()) {
        fields.displayName.setError('Укажите имя');
        hasErrors = true;
      } else {
        fields.displayName.setError(null);
      }

      if (fields.password.getValue() !== fields.passwordConfirm.getValue()) {
        fields.passwordConfirm.setError('Пароли не совпадают');
        hasErrors = true;
      } else {
        fields.passwordConfirm.setError(null);
      }

      if (hasErrors) return;

      submitBtn.setLoading(true);

      try {
        const auth = window.__auth;
        await auth.register({
          login: fields.login.getValue(),
          email: fields.email.getValue(),
          password: fields.password.getValue(),
          displayName: fields.displayName.getValue()
        });
        Toast.success('Регистрация успешна!');
        this.router.navigate('/');
      } catch (err) {
        Toast.error(err.message || 'Ошибка регистрации');
        submitBtn.setLoading(false);
      }
    });

    card.appendChild(form);

    // Ссылка на логин
    const footer = el('div', { class: 'auth-form__footer' });
    footer.innerHTML = 'Уже есть аккаунт? <a href="#/login">Войти</a>';
    card.appendChild(footer);

    page.appendChild(card);
    container.appendChild(page);
  }
}
