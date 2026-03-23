/**
 * Кастомный SPA-роутер на hash-навигации.
 * Поддерживает параметры (:id), guard по ролям, layouts.
 */
export class Router {
  constructor() {
    this.routes = [];
    this.currentPage = null;
    this.container = null;
    this.getUser = null; // функция для получения текущего пользователя
  }

  /**
   * Регистрация маршрута
   * @param {string} path - шаблон пути (напр. '/tickets/:id')
   * @param {Function} pageFactory - функция/класс страницы
   * @param {object} options - { roles, layout }
   */
  route(path, pageFactory, options = {}) {
    this.routes.push({ path, pageFactory, ...options });
    return this;
  }

  /**
   * Установить функцию получения текущего пользователя
   */
  setAuthProvider(fn) {
    this.getUser = fn;
    return this;
  }

  /**
   * Запуск роутера
   */
  start(container) {
    this.container = container;
    window.addEventListener('hashchange', () => this.resolve());
    this.resolve();
  }

  /**
   * Программная навигация
   */
  navigate(path) {
    window.location.hash = path;
  }

  /**
   * Разбор текущего хэша и рендер
   */
  resolve() {
    const hash = window.location.hash.slice(1) || '/';

    for (const route of this.routes) {
      const params = this._matchRoute(route.path, hash);
      if (params === null) continue;

      // Guard: проверка роли
      if (route.roles && this.getUser) {
        const user = this.getUser();
        if (!user || !route.roles.includes(user.role)) {
          this.navigate(user ? '/' : '/login');
          return;
        }
      }

      // Guard: гость (без авторизации)
      if (route.guest === undefined && route.roles && this.getUser) {
        const user = this.getUser();
        if (!user) {
          this.navigate('/login');
          return;
        }
      }

      this._render(route, params);
      return;
    }

    // 404
    this.container.innerHTML = `
      <div class="error-screen">
        <h1>404</h1>
        <p>Страница не найдена</p>
        <a href="#/" class="btn btn--primary mt-lg">На главную</a>
      </div>
    `;
  }

  /**
   * Рендер страницы
   */
  _render(route, params) {
    // Уничтожить предыдущую страницу
    if (this.currentPage && this.currentPage.destroy) {
      this.currentPage.destroy();
    }

    this.container.innerHTML = '';

    const page = typeof route.pageFactory === 'function'
      ? new route.pageFactory(this, params)
      : route.pageFactory;

    this.currentPage = page;

    if (page.render) {
      page.render(this.container);
    }
  }

  /**
   * Сопоставление пути с шаблоном.
   * Возвращает объект параметров или null.
   *
   * '/tickets/:id' + '/tickets/abc' → { id: 'abc' }
   */
  _matchRoute(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) return null;

    const params = {};

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }

    return params;
  }
}
