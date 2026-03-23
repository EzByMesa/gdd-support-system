/**
 * Система уведомлений (Toast).
 * Использование: Toast.success('Сохранено!'), Toast.error('Ошибка!')
 */
export class Toast {
  static _container = null;

  static _getContainer() {
    if (!this._container) {
      this._container = document.getElementById('toast-container');
    }
    return this._container;
  }

  static show(message, variant = 'info', duration = 4000) {
    const container = this._getContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast--${variant}`;
    toast.innerHTML = `
      <span class="toast__message">${this._escape(message)}</span>
      <button class="toast__close">&times;</button>
    `;

    const close = () => {
      toast.classList.add('toast--exit');
      setTimeout(() => toast.remove(), 200);
    };

    toast.querySelector('.toast__close').addEventListener('click', close);
    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(close, duration);
    }

    return close;
  }

  static success(message) {
    return this.show(message, 'success');
  }

  static error(message) {
    return this.show(message, 'error', 6000);
  }

  static warning(message) {
    return this.show(message, 'warning', 5000);
  }

  static info(message) {
    return this.show(message, 'info');
  }

  static _escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
