/**
 * Конфигурация фронтенда.
 *
 * Загружается из /config.json (папка public) при старте приложения.
 * В production: отредактируйте dist/config.json после сборки.
 *
 * Параметры config.json:
 *   backend_url — полный URL бэкенда (например "https://api.example.com").
 *                 Пустая строка = тот же хост (через proxy или same-origin).
 */

const config = {
  backendUrl: '',
  apiPath: '/api',
  wsPath: '/ws',

  get apiUrl() {
    return `${this.backendUrl}${this.apiPath}`;
  },

  get wsUrl() {
    const base = this.backendUrl;
    if (base) {
      const wsBase = base.replace(/^http/, 'ws');
      return `${wsBase}${this.wsPath}`;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}${this.wsPath}`;
  }
};

/**
 * Загрузить конфигурацию из /config.json.
 * Вызывается один раз при старте приложения (main.js).
 */
export async function loadConfig() {
  try {
    const res = await fetch('/config.json');
    if (res.ok) {
      const json = await res.json();
      if (json.backend_url) {
        config.backendUrl = json.backend_url.replace(/\/+$/, ''); // убрать trailing slash
        console.log(`[Config] Backend URL: ${config.backendUrl}`);
      }
    }
  } catch {
    // config.json недоступен — используем дефолты
  }
}

export default config;
