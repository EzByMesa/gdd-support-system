/**
 * Обёртка для async route handlers.
 * Ловит ошибки и передаёт в Express error handler.
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
