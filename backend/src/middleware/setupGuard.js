import { getModels } from '../models/index.js';

let setupComplete = null;

export async function checkSetupState() {
  try {
    const { SetupState } = getModels();
    const state = await SetupState.findByPk('singleton');
    setupComplete = state?.isComplete || false;
  } catch {
    // Таблица ещё не существует — значит setup не завершён
    setupComplete = false;
  }
  return setupComplete;
}

export function resetSetupCache() {
  setupComplete = null;
}

export function setupGuard(req, res, next) {
  // Эндпоинты setup и health — всегда доступны
  if (req.path.startsWith('/api/setup') || req.path === '/api/health') {
    return next();
  }

  if (setupComplete !== true) {
    return res.status(503).json({
      error: {
        code: 'SETUP_REQUIRED',
        message: 'System setup is not complete'
      }
    });
  }

  next();
}
