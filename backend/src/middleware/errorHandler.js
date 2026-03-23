export function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message);

  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Ошибка валидации',
        details: err.errors.map(e => ({ field: e.path, message: e.message }))
      }
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'Запись уже существует',
        details: err.errors.map(e => ({ field: e.path, message: e.message }))
      }
    });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: status === 500 ? 'Внутренняя ошибка сервера' : err.message
    }
  });
}
