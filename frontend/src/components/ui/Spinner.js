import { el } from '../../utils/dom.js';

export class Spinner {
  /**
   * @param {string} size - sm | md | lg
   */
  constructor(size = 'md') {
    this.el = el('div', { class: 'spinner-container' }, [
      el('div', { class: `spinner${size !== 'md' ? ` spinner--${size}` : ''}` })
    ]);
  }

  mount(parent) {
    parent.appendChild(this.el);
    return this;
  }

  remove() {
    this.el.remove();
  }
}
