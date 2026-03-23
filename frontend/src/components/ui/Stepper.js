import { el } from '../../utils/dom.js';

export class Stepper {
  /**
   * @param {Array<string>} steps - названия шагов
   * @param {number} current - текущий (0-based)
   */
  constructor(steps, current = 0) {
    this.steps = steps;
    this.current = current;
    this.el = el('div', { class: 'stepper' });
    this._render();
  }

  setCurrent(index) {
    this.current = index;
    this._render();
  }

  _render() {
    this.el.innerHTML = '';

    this.steps.forEach((label, i) => {
      if (i > 0) {
        const line = el('div', {
          class: `stepper__line${i <= this.current ? ' stepper__line--completed' : ''}`
        });
        this.el.appendChild(line);
      }

      let stepClass = 'stepper__step';
      if (i === this.current) stepClass += ' stepper__step--active';
      else if (i < this.current) stepClass += ' stepper__step--completed';

      const circle = el('div', { class: 'stepper__circle' },
        i < this.current ? '\u2713' : String(i + 1)
      );

      const step = el('div', { class: stepClass }, [
        circle,
        el('span', { class: 'stepper__label' }, label)
      ]);

      this.el.appendChild(step);
    });
  }

  mount(parent) {
    parent.appendChild(this.el);
    return this;
  }
}
