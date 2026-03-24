import { inject } from 'vue';

/**
 * Composable для тост-уведомлений через Vuetify v-snackbar.
 */
export function useToast() {
  const snackbar = inject('snackbar', null);
  return {
    success: (text) => snackbar?.show(text, 'success', 4000),
    error: (text) => snackbar?.show(text, 'error', 6000),
    warning: (text) => snackbar?.show(text, 'warning', 5000),
    info: (text) => snackbar?.show(text, 'info', 4000),
  };
}

/**
 * Fallback для использования вне setup() — в stores, services.
 * DOM-based toast.
 */
export const toast = {
  success(msg) { _show(msg, '#4CAF50'); },
  error(msg) { _show(msg, '#F44336', 6000); },
  warning(msg) { _show(msg, '#FF9800', 5000); },
  info(msg) { _show(msg, '#2196F3'); },
};

function _show(message, bg, duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    Object.assign(container.style, {
      position: 'fixed', top: '16px', right: '16px', zIndex: '9999',
      display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none'
    });
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.textContent = message;
  Object.assign(el.style, {
    padding: '12px 20px', borderRadius: '8px', color: '#fff', background: bg,
    fontSize: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    maxWidth: '360px', pointerEvents: 'auto', cursor: 'pointer'
  });
  el.onclick = () => el.remove();
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, duration);
}
