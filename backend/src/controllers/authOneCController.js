import jwt from 'jsonwebtoken';
import { getModels } from '../models/index.js';
import { Role, AuthProviderType } from '../models/enums.js';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '30d';
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, login: user.login, isRootAdmin: user.isRootAdmin || false },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: '/'
  });
}

function userResponse(user) {
  return {
    id: user.id,
    login: user.login,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    isRootAdmin: user.isRootAdmin
  };
}

/**
 * POST /api/auth/1c
 *
 * Алгоритм:
 * 1. Получаем login + password из запроса
 * 2. Находим активный AuthProvider типа ONE_C
 * 3. Отправляем запрос к 1С HTTP-сервису для валидации
 * 4. Если пользователь не найден в локальной БД — создаём
 * 5. Если найден — обновляем displayName/email
 * 6. Возвращаем ЛОКАЛЬНЫЙ JWT (не токен 1С!)
 */
export async function loginOneC(req, res) {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Укажите логин и пароль 1С' }
    });
  }

  const { AuthProvider, User } = getModels();

  // Ищем активный провайдер 1С
  const provider = await AuthProvider.findOne({
    where: { type: AuthProviderType.ONE_C, isActive: true }
  });

  if (!provider) {
    return res.status(400).json({
      error: { code: 'PROVIDER_NOT_CONFIGURED', message: 'Авторизация через 1С не настроена' }
    });
  }

  const config = provider.config || {};
  const baseUrl = config.baseUrl;
  const authEndpoint = config.authEndpoint || '/auth/validate';
  const timeout = config.timeout || 5000;

  if (!baseUrl) {
    return res.status(500).json({
      error: { code: 'PROVIDER_MISCONFIGURED', message: 'Не задан URL сервера 1С' }
    });
  }

  // Запрос к 1С
  let oneCUser;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const oneCResponse = await fetch(`${baseUrl}${authEndpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64'),
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!oneCResponse.ok) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Неверный логин или пароль 1С' }
      });
    }

    const oneCData = await oneCResponse.json();

    if (!oneCData.success) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: oneCData.message || 'Ошибка авторизации 1С' }
      });
    }

    oneCUser = oneCData.user;
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({
        error: { code: 'PROVIDER_TIMEOUT', message: 'Сервер 1С не ответил вовремя' }
      });
    }
    return res.status(502).json({
      error: { code: 'PROVIDER_UNAVAILABLE', message: `Не удалось подключиться к 1С: ${err.message}` }
    });
  }

  // Ищем или создаём пользователя в локальной БД
  let user = await User.findOne({
    where: { externalId: oneCUser.id, authProvider: AuthProviderType.ONE_C }
  });

  if (!user) {
    // Пробуем найти по логину
    user = await User.findOne({ where: { login } });
  }

  if (user) {
    // Обновляем данные из 1С
    await user.update({
      displayName: oneCUser.name || user.displayName,
      email: oneCUser.email || user.email,
      externalId: oneCUser.id,
      authProvider: AuthProviderType.ONE_C
    });
  } else {
    // Создаём новую учётку
    const defaultRole = config.defaultRole || Role.USER;

    user = await User.create({
      login,
      email: oneCUser.email || null,
      displayName: oneCUser.name || login,
      role: defaultRole,
      authProvider: AuthProviderType.ONE_C,
      externalId: oneCUser.id,
      passwordHash: null // вход только через 1С
    });
  }

  if (!user.isActive) {
    return res.status(403).json({
      error: { code: 'ACCOUNT_DISABLED', message: 'Учётная запись деактивирована' }
    });
  }

  // Генерируем ЛОКАЛЬНЫЙ JWT
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  setRefreshCookie(res, refreshToken);

  res.json({ accessToken, user: userResponse(user) });
}
