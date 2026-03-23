import { el } from '../../utils/dom.js';

export class Button {
  /**
   * @param {object} opts
   * @param {string} opts.text
   * @param {string} opts.variant - primary | secondary | danger | ghost
   * @param {string} opts.size - sm | md | lg
   * @param {boolean} opts.block - на всю ширину
   * @param {boolean} opts.disabled
   * @param {Function} opts.onClick
   * @param {string} opts.type - button | submit
   * @param {string} opts.icon - HTML иконки (опц.)
   */
  constructor({ text, variant = 'primary', size, block, disabled, onClick, type = 'button', icon } = {}) {
    const classes = ['btn', `btn--${variant}`];
    if (size) classes.push(`btn--${size}`);
    if (block) classes.push('btn--block');

    this.el = el('button', {
      class: classes.join(' '),
      type,
      disabled: disabled || undefined
    });

    if (icon) {
      this.el.innerHTML = icon;
      if (text) this.el.appendChild(document.createTextNode(` ${text}`));
    } else {
      this.el.textContent = text;
    }

    if (onClick) this.el.addEventListener('click', onClick);
  }

  setLoading(loading) {
    this.el.disabled = loading;
    this.el.classList.toggle('btn--loading', loading);
  }

  setDisabled(disabled) {
    this.el.disabled = disabled;
  }

  setText(text) {
    this.el.textContent = text;
  }

  mount(parent) {
    parent.appendChild(this.el);
    return this;
  }
}
