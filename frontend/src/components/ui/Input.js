import { el } from '../../utils/dom.js';

export class Input {
  /**
   * @param {object} opts
   * @param {string} opts.label
   * @param {string} opts.type - text | password | email | number
   * @param {string} opts.name
   * @param {string} opts.placeholder
   * @param {string} opts.value
   * @param {boolean} opts.required
   * @param {string} opts.error - текст ошибки
   * @param {Function} opts.onInput
   */
  constructor({ label, type = 'text', name, placeholder, value, required, error, onInput } = {}) {
    this.el = el('div', { class: 'input-group' });

    if (label) {
      this.labelEl = el('label', { for: name }, label + (required ? ' *' : ''));
      this.el.appendChild(this.labelEl);
    }

    this.input = el('input', {
      class: `input${error ? ' input--error' : ''}`,
      type,
      name: name || '',
      placeholder: placeholder || '',
      value: value || ''
    });

    if (required) this.input.required = true;
    if (onInput) this.input.addEventListener('input', (e) => onInput(e.target.value, e));

    this.el.appendChild(this.input);

    this.errorEl = el('span', { class: 'input-error-text' }, error || '');
    if (error) this.el.appendChild(this.errorEl);
  }

  getValue() {
    return this.input.value;
  }

  setValue(val) {
    this.input.value = val;
  }

  setError(msg) {
    this.input.classList.toggle('input--error', !!msg);
    this.errorEl.textContent = msg || '';
    if (msg && !this.errorEl.parentNode) {
      this.el.appendChild(this.errorEl);
    } else if (!msg && this.errorEl.parentNode) {
      this.errorEl.remove();
    }
  }

  focus() {
    this.input.focus();
  }

  mount(parent) {
    parent.appendChild(this.el);
    return this;
  }
}
