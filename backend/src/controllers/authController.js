import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getModels } from '../models/index.js';
import { Role } from '../models/enums.js';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '30d';
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 дней

function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      login: user.login,
      isRootAdmin: user.isRootAdmin || false
    },
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
    isRootAdmin: user.isRootAdmin
  };
}

/**
 * POST /api/auth/login
 */
export async function login(req, res) {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Укажите логин и пароль' }
    });
  }

  const { User } = getModels();

  const user = await User.findOne({ where: { login } });
  if (!user) {
    return res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Неверный логин или пароль' }
    });
  }

  if (!user.isActive) {
    return res.status(403).json({
      error: { code: 'ACCOUNT_DISABLED', message: 'Учётная запись деактивирована' }
    });
  }

  if (!user.passwordHash) {
    return res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Для этой учётной записи используйте вход через 1С' }
    });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Неверный логин или пароль' }
    });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  setRefreshCookie(res, refreshToken);

  res.json({ accessToken, user: userResponse(user) });
}

/**
 * POST /api/auth/register
 */
export async function register(req, res) {
  // Проверяем, включена ли регистрация
  const { SystemSettings, User } = getModels();

  const regSetting = await SystemSettings.findOne({ where: { key: 'registration.enabled' } });
  if (regSetting && regSetting.value === false) {
    return res.status(403).json({
      error: { code: 'REGISTRATION_DISABLED', message: 'Регистрация отключена' }
    });
  }

  const { login, email, password, displayName } = req.body;

  if (!login || !password || !displayName) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Заполните логин, пароль и имя' }
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Пароль должен быть не менее 8 символов' }
    });
  }

  if (login.length < 3 || !/^[a-zA-Z0-9_.\-]+$/.test(login)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Логин: мин. 3 символа, только латиница, цифры, _ . -' }
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await User.create({
      login,
      email: email || null,
      passwordHash,
      displayName,
      role: Role.USER // всегда USER при регистрации
    });

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

/**
 * POST /api/auth/refresh
 */
export async function refresh(req, res) {
  const token = req.cookies?.refreshToken;

  if (!token) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Refresh token отсутствует' }
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'refresh') {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Невалидный refresh token' }
      });
    }

    const { User } = getModels();
    const user = await User.findByPk(payload.sub);

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Пользователь не найден или деактивирован' }
      });
    }

    const accessToken = generateAccessToken(user);
    // Ротация refresh token
    const newRefreshToken = generateRefreshToken(user);
    setRefreshCookie(res, newRefreshToken);

    res.json({ accessToken });
  } catch {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Refresh token истёк или невалиден' }
    });
  }
}

/**
 * POST /api/auth/logout
 */
export async function logout(req, res) {
  res.clearCookie('refreshToken', { path: '/' });
  res.json({ data: { success: true } });
}

/**
 * GET /api/auth/me
 */
export async function me(req, res) {
  const { User } = getModels();
  const user = await User.findByPk(req.user.sub);

  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Пользователь не найден' }
    });
  }

  res.json({ data: userResponse(user) });
}

/**
 * GET /api/auth/providers
 * Список активных провайдеров авторизации (для UI)
 */
export async function getProviders(req, res) {
  const { AuthProvider } = getModels();

  const providers = await AuthProvider.findAll({
    where: { isActive: true },
    attributes: ['id', 'type', 'name']
  });

  // Всегда добавляем LOCAL
  const result = [{ type: 'LOCAL', name: 'Логин и пароль' }];

  for (const p of providers) {
    if (p.type !== 'LOCAL') {
      result.push({ type: p.type, name: p.name });
    }
  }

  res.json({ data: result });
}
