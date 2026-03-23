import { el } from '../../utils/dom.js';

export class Modal {
  /**
   * @param {object} opts
   * @param {string} opts.title
   * @param {Function} opts.onClose
   */
  constructor({ title, onClose } = {}) {
    this.onClose = onClose;

    this.backdrop = el('div', {
      class: 'modal-backdrop',
      onClick: () => this.close()
    });

    this.modal = el('div', { class: 'modal' });
    this.modal.addEventListener('click', (e) => e.stopPropagation());

    // Header
    const header = el('div', { class: 'modal__header' }, [
      el('h2', {}, title || ''),
      el('button', { class: 'modal__close', onClick: () => this.close() }, '\u00D7')
    ]);

    // Body
    this.body = el('div', { class: 'modal__body' });

    // Footer
    this.footer = el('div', { class: 'modal__footer' });

    this.modal.appendChild(header);
    this.modal.appendChild(this.body);
    this.modal.appendChild(this.footer);

    // Escape key
    this._onKeyDown = (e) => {
      if (e.key === 'Escape') this.close();
    };
  }

  /**
   * Получить body для вставки контента
   */
  getBody() {
    return this.body;
  }

  /**
   * Получить footer для кнопок
   */
  getFooter() {
    return this.footer;
  }

  open() {
    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.modal);
    document.addEventListener('keydown', this._onKeyDown);
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.backdrop.remove();
    this.modal.remove();
    document.removeEventListener('keydown', this._onKeyDown);
    document.body.style.overflow = '';
    if (this.onClose) this.onClose();
  }
}
