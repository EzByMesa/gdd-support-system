/**
 * Валидация полей форм.
 * Возвращает объект ошибок { fieldName: 'сообщение' } или пустой {}.
 */

export function validateLogin(login) {
  if (!login || login.trim().length < 3) {
    return 'Логин должен быть не короче 3 символов';
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(login)) {
    return 'Логин может содержать только латинские буквы, цифры, _ . -';
  }
  return null;
}

export function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Пароль должен быть не короче 8 символов';
  }
  return null;
}

export function validateEmail(email) {
  if (!email) return null; // email необязателен
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Некорректный email';
  }
  return null;
}

export function validateRequired(value, fieldName) {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return `${fieldName} обязательно`;
  }
  return null;
}

/**
 * Валидация нескольких полей.
 * @param {object} rules - { fieldName: validatorFn(value) }
 * @param {object} values - { fieldName: value }
 * @returns {{ isValid: boolean, errors: object }}
 */
export function validate(rules, values) {
  const errors = {};
  for (const [field, validator] of Object.entries(rules)) {
    const error = validator(values[field]);
    if (error) errors[field] = error;
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
