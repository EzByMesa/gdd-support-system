import bcrypt from 'bcryptjs';
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
    sameSite: 'lax',
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
    isRootAdmin: user.isRootAdmin,
    avatarPath: user.avatarPath || null
  };
}

/**
 * Запрос к 1С для получения профиля пользователя.
 */
async function fetchOneCProfile(login, password) {
  const { AuthProvider } = getModels();

  const provider = await AuthProvider.findOne({
    where: { type: AuthProviderType.ONE_C, isActive: true }
  });

  if (!provider) {
    return { error: { status: 400, code: 'PROVIDER_NOT_CONFIGURED', message: 'Регистрация через 1С не настроена' } };
  }

  const config = provider.config || {};
  const baseUrl = config.baseUrl;
  const authEndpoint = config.authEndpoint || '/auth/validate';
  const timeout = config.timeout || 5000;

  if (!baseUrl) {
    console.error('[Provider] Провайдер не настроен: baseUrl не задан');
    return { error: { status: 500, code: 'PROVIDER_MISCONFIGURED', message: 'Не задан URL сервера' } };
  }

  const url = `${baseUrl}${authEndpoint}`;
  console.log(`[Provider] Запрос профиля: POST ${url}, логин: ${login}, таймаут: ${timeout}ms`);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const oneCResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64'),
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timer);

    console.log(`[Provider] Ответ: HTTP ${oneCResponse.status} ${oneCResponse.statusText}`);

    if (!oneCResponse.ok) {
      console.log(`[Provider] Авторизация отклонена (${oneCResponse.status})`);
      return { error: { status: 401, code: 'INVALID_CREDENTIALS', message: 'Неверный логин или пароль' } };
    }

    const oneCData = await oneCResponse.json();
    console.log(`[Provider] Получены данные: ${JSON.stringify(oneCData).substring(0, 1000)}`);

    // 1С возвращает { access: true/false, data: { guid, name, ... } }
    if (!oneCData.access || !oneCData.data) {
      console.log(`[Provider] Авторизация не пройдена: access=${oneCData.access}, data=${!!oneCData.data}`);
      return { error: { status: 401, code: 'INVALID_CREDENTIALS', message: oneCData.message || 'Ошибка авторизации' } };
    }

    const profile = oneCData.data;
    console.log(`[Provider] Профиль: guid=${profile.guid}, name="${profile.name}", email=${profile.email || '(нет)'}, phone=${profile.phone || '(нет)'}`);
    return { profile, config };
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(`[Provider] Таймаут: сервер не ответил за ${timeout}ms`);
      return { error: { status: 504, code: 'PROVIDER_TIMEOUT', message: `Сервер не ответил вовремя (${timeout}ms)` } };
    }
    const cause = err.cause || {};
    console.error(`[Provider] Недоступен: ${err.message}`);
    if (cause.code) console.error(`[Provider]   Код: ${cause.code}`);
    if (cause.syscall) console.error(`[Provider]   Syscall: ${cause.syscall}`);
    if (cause.hostname) console.error(`[Provider]   Hostname: ${cause.hostname}`);
    if (cause.port) console.error(`[Provider]   Port: ${cause.port}`);
    if (cause.address) console.error(`[Provider]   Address: ${cause.address}`);
    console.error(`[Provider]   Stack: ${err.stack}`);

    const detail = cause.code
      ? `${cause.code}${cause.address ? ` (${cause.address}:${cause.port})` : ''}`
      : err.message;
    return { error: { status: 502, code: 'PROVIDER_UNAVAILABLE', message: `Не удалось подключиться: ${detail}` } };
  }
}

/**
 * POST /api/auth/1c/profile
 *
 * Превью: получить профиль из 1С, показать на фронте перед регистрацией.
 */
export async function getOneCProfile(req, res) {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Укажите логин и пароль' }
    });
  }

  console.log(`[Provider] Запрос профиля для превью: логин=${login}`);
  const { User } = getModels();

  const result = await fetchOneCProfile(login, password);
  if (result.error) {
    const { status, ...err } = result.error;
    return res.status(status).json({ error: err });
  }

  const profile = result.profile;

  // Проверяем, не зарегистрирован ли уже
  const existing = await User.findOne({
    where: { externalId: profile.guid, authProvider: AuthProviderType.ONE_C }
  });

  if (existing) {
    console.log(`[Provider] Пользователь уже зарегистрирован: guid=${profile.guid}, login=${existing.login}`);
    return res.status(409).json({
      error: { code: 'ALREADY_REGISTERED', message: 'Пользователь с этой учётной записью уже зарегистрирован. Используйте обычный вход.' }
    });
  }

  console.log(`[Provider] Профиль для превью: name="${profile.name}", email=${profile.email || '(нет)'}, guid=${profile.guid}`);

  res.json({
    data: {
      guid: profile.guid,
      name: profile.name,
      email: profile.email || null,
      phone: profile.phone || null,
      district: profile.district?.name || null
    }
  });
}

/**
 * POST /api/auth/register/1c
 *
 * Регистрация через 1С.
 * Принимает { login, password } — те же credentials, что и для 1С.
 * Логин и пароль от 1С становятся локальными.
 * Имя, email берутся из профиля 1С.
 */
export async function registerOneC(req, res) {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Укажите логин и пароль' }
    });
  }

  console.log(`[Provider] Регистрация через провайдер: логин=${login}`);

  // Проверяем, включена ли регистрация
  const { SystemSettings, User } = getModels();
  const regSetting = await SystemSettings.findOne({ where: { key: 'registration.enabled' } });
  if (regSetting && regSetting.value === false) {
    return res.status(403).json({
      error: { code: 'REGISTRATION_DISABLED', message: 'Регистрация отключена' }
    });
  }

  // Верифицируем через 1С и получаем профиль
  const result = await fetchOneCProfile(login, password);
  if (result.error) {
    const { status, ...err } = result.error;
    return res.status(status).json({ error: err });
  }

  const profile = result.profile;
  const config = result.config;
  const externalId = profile.guid;

  // Проверяем, не зарегистрирован ли уже
  const existingByExtId = await User.findOne({
    where: { externalId, authProvider: AuthProviderType.ONE_C }
  });
  if (existingByExtId) {
    return res.status(409).json({
      error: { code: 'ALREADY_REGISTERED', message: 'Пользователь с этой учётной записью 1С уже зарегистрирован' }
    });
  }

  // Пароль от 1С = локальный пароль
  const passwordHash = await bcrypt.hash(password, 12);
  const defaultRole = config.defaultRole || Role.USER;

  try {
    const user = await User.create({
      login,
      email: profile.email || null,
      displayName: profile.name || login,
      passwordHash,
      role: defaultRole,
      authProvider: AuthProviderType.ONE_C,
      externalId
    });

    console.log(`[Provider] Пользователь создан: id=${user.id}, login=${user.login}, name="${user.displayName}", role=${user.role}, externalId=${externalId}`);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    setRefreshCookie(res, refreshToken);

    res.status(201).json({ accessToken, user: userResponse(user) });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      const field = err.errors?.[0]?.path;
      const msg = field === 'email'
        ? 'Пользователь с таким email уже существует'
        : 'Пользователь с таким логином уже существует';
      return res.status(409).json({ error: { code: 'CONFLICT', message: msg } });
    }
    throw err;
  }
}
