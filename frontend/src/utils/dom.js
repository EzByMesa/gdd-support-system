/**
 * Создание DOM-элемента
 * @param {string} tag
 * @param {object} attrs - атрибуты { class, id, ... }
 * @param {(string|Node|Array)} children
 */
export function el(tag, attrs = {}, children = null) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') {
      element.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset') {
      Object.assign(element.dataset, value);
    } else if (value != null && value !== false) {
      element.setAttribute(key, value === true ? '' : value);
    }
  }

  if (children !== null) {
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child == null) continue;
        if (typeof child === 'string') {
          element.appendChild(document.createTextNode(child));
        } else {
          element.appendChild(child);
        }
      }
    } else if (typeof children === 'string') {
      element.textContent = children;
    } else {
      element.appendChild(children);
    }
  }

  return element;
}

/**
 * Очистить содержимое элемента
 */
export function clearEl(element) {
  element.innerHTML = '';
  return element;
}
