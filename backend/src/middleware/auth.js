import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  // 1. Bearer token из заголовка
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // 2. Fallback: refreshToken из cookie (для скачивания файлов через браузер)
  if (!token && req.cookies?.refreshToken) {
    try {
      const refreshPayload = jwt.verify(req.cookies.refreshToken, process.env.JWT_SECRET);
      if (refreshPayload.type === 'refresh') {
        // Создаём user payload из refresh token
        // Нужно подгрузить пользователя — но для download достаточно sub
        req.user = { sub: refreshPayload.sub };

        // Подгружаем полные данные пользователя
        import('../models/index.js').then(({ getModels }) => {
          const { User } = getModels();
          User.findByPk(refreshPayload.sub).then(user => {
            if (!user || !user.isActive) {
              return res.status(401).json({
                error: { code: 'UNAUTHORIZED', message: 'Пользователь не найден' }
              });
            }
            req.user = {
              sub: user.id,
              role: user.role,
              login: user.login,
              isRootAdmin: user.isRootAdmin
            };
            next();
          });
        });
        return;
      }
    } catch {
      // cookie невалидна — продолжаем к ошибке
    }
  }

  if (!token) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация' }
    });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: { code: 'TOKEN_EXPIRED', message: 'Токен истёк' }
      });
    }
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Невалидный токен' }
    });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация' }
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Недостаточно прав' }
      });
    }

    next();
  };
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Требуются права администратора' }
    });
  }
  next();
}
