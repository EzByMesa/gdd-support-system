import { el } from '../../utils/dom.js';

export class Badge {
  /**
   * @param {string} text
   * @param {string} variant - open | in-progress | waiting | resolved | closed | low | medium | high | critical | count
   */
  constructor(text, variant = '') {
    this.el = el('span', {
      class: `badge${variant ? ` badge--${variant}` : ''}`
    }, text);
  }

  mount(parent) {
    parent.appendChild(this.el);
    return this;
  }
}
