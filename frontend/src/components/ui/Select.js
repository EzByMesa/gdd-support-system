import { el } from '../../utils/dom.js';

export class Select {
  /**
   * @param {object} opts
   * @param {string} opts.label
   * @param {string} opts.name
   * @param {Array<{value, text}>} opts.options
   * @param {string} opts.value
   * @param {string} opts.placeholder
   * @param {Function} opts.onChange
   */
  constructor({ label, name, options = [], value, placeholder, onChange } = {}) {
    this.el = el('div', { class: 'input-group' });

    if (label) {
      this.el.appendChild(el('label', { for: name }, label));
    }

    this.select = el('select', { class: 'select', name: name || '' });

    if (placeholder) {
      const opt = el('option', { value: '' }, placeholder);
      opt.disabled = true;
      opt.selected = !value;
      this.select.appendChild(opt);
    }

    for (const o of options) {
      const opt = el('option', { value: o.value }, o.text);
      if (o.value === value) opt.selected = true;
      this.select.appendChild(opt);
    }

    if (onChange) {
      this.select.addEventListener('change', (e) => onChange(e.target.value));
    }

    this.el.appendChild(this.select);
  }

  getValue() {
    return this.select.value;
  }

  mount(parent) {
    parent.appendChild(this.el);
    return this;
  }
}
