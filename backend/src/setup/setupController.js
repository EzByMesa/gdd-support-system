import { Sequelize } from 'sequelize';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { initDatabase, getModels, getSequelize } from '../models/index.js';
import { resetSetupCache, checkSetupState } from '../middleware/setupGuard.js';
import { Role } from '../models/enums.js';
import { initVapid } from '../services/notification.js';

// Состояние Setup в памяти (до записи в БД)
let setupContext = {
  databaseUrl: null,
  sequelize: null
};

/**
 * GET /api/setup/status
 * Проверяет состояние настройки
 */
export async function getSetupStatus(req, res) {
  try {
    const models = getModels();

    // Если модели ещё не инициализированы — setup не начат
    if (!models.SetupState) {
      return res.json({
        data: {
          isComplete: false,
          completedSteps: [],
          needsSetup: true
        }
      });
    }

    const state = await models.SetupState.findByPk('singleton');
    res.json({
      data: {
        isComplete: state?.isComplete || false,
        completedSteps: state?.completedSteps || [],
        needsSetup: !state?.isComplete
      }
    });
  } catch {
    res.json({
      data: {
        isComplete: false,
        completedSteps: [],
        needsSetup: true
      }
    });
  }
}

/**
 * POST /api/setup/step/database
 * Шаг 1: Подключение к БД (PostgreSQL или SQLite)
 *
 * Для PostgreSQL: { dbType: "postgres", host, port, database, username, password }
 * Для SQLite:     { dbType: "sqlite", path: "/path/to/database.sqlite" }
 */
export async function stepDatabase(req, res) {
  const { dbType = 'postgres' } = req.body;

  let databaseUrl;
  let dialect;

  if (dbType === 'sqlite') {
    const { path: dbPath } = req.body;
    if (!dbPath) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Укажите путь к файлу базы данных' }
      });
    }

    // Создаём директорию если не существует
    const dir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    databaseUrl = path.resolve(dbPath);
    dialect = 'sqlite';
  } else {
    const { host, port, database, username, password } = req.body;

    if (!host || !database || !username) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Заполните все обязательные поля' }
      });
    }

    const dbPort = port || 5432;
    databaseUrl = `postgres://${encodeURIComponent(username)}:${encodeURIComponent(password || '')}@${host}:${dbPort}/${database}`;
    dialect = 'postgres';
  }

  try {
    // Пробуем подключиться
    if (dialect === 'postgres') {
      const testSeq = new Sequelize(databaseUrl, { logging: false, dialect: 'postgres' });
      await testSeq.authenticate();
      await testSeq.close();
    }

    // Инициализируем модели и создаём таблицы
    const { sequelize, models } = initDatabase(databaseUrl, { dialect });
    await sequelize.sync();

    // Создаём или обновляем SetupState
    await models.SetupState.findOrCreate({
      where: { id: 'singleton' },
      defaults: { isComplete: false, completedSteps: ['database'] }
    });

    const state = await models.SetupState.findByPk('singleton');
    const steps = [...(state.completedSteps || [])];
    if (!steps.includes('database')) {
      steps.push('database');
    }
    await state.update({ completedSteps: steps });

    // Записываем в .env
    _writeEnv('DATABASE_URL', databaseUrl);
    _writeEnv('DB_DIALECT', dialect);

    setupContext.databaseUrl = databaseUrl;

    const dbLabel = dialect === 'sqlite' ? 'SQLite' : 'PostgreSQL';
    res.json({
      data: { success: true, step: 'database', message: `Подключение к ${dbLabel} установлено` }
    });
  } catch (err) {
    res.status(400).json({
      error: {
        code: 'DB_CONNECTION_FAILED',
        message: `Не удалось подключиться: ${err.message}`
      }
    });
  }
}

/**
 * POST /api/setup/step/admin
 * Шаг 2: Создание администратора
 */
export async function stepAdmin(req, res) {
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

  try {
    const { User, SetupState } = getModels();

    // Проверяем, не создан ли уже администратор
    const existingAdmin = await User.findOne({ where: { isRootAdmin: true } });
    if (existingAdmin) {
      return res.status(409).json({
        error: { code: 'ADMIN_EXISTS', message: 'Корневой администратор уже создан' }
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await User.create({
      login,
      email: email || null,
      passwordHash,
      displayName,
      role: Role.ADMIN,
      isRootAdmin: true
    });

    // Обновляем шаги
    const state = await SetupState.findByPk('singleton');
    const steps = [...(state.completedSteps || [])];
    if (!steps.includes('admin')) {
      steps.push('admin');
    }
    await state.update({ completedSteps: steps });

    res.json({
      data: { success: true, step: 'admin', message: 'Администратор создан' }
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: { code: 'CONFLICT', message: 'Пользователь с таким логином или email уже существует' }
      });
    }
    throw err;
  }
}

/**
 * POST /api/setup/step/storage
 * Шаг 3: Настройка хранилища вложений
 */
export async function stepStorage(req, res) {
  const { storagePath } = req.body;

  if (!storagePath) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Укажите путь к папке хранилища' }
    });
  }

  const resolvedPath = path.resolve(storagePath);

  try {
    // Создаём папку если не существует
    if (!fs.existsSync(resolvedPath)) {
      fs.mkdirSync(resolvedPath, { recursive: true });
    }

    // Проверяем права на запись
    const testFile = path.join(resolvedPath, '.write_test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);

    // Генерируем мастер-ключ шифрования (AES-256 = 32 байта)
    const encryptionKey = crypto.randomBytes(32).toString('hex');

    const { SystemSettings, SetupState } = getModels();

    // Сохраняем настройки
    await SystemSettings.findOrCreate({
      where: { key: 'storage.path' },
      defaults: { value: resolvedPath }
    });
    await SystemSettings.findOrCreate({
      where: { key: 'storage.encryptionKey' },
      defaults: { value: encryptionKey }
    });

    // Обновляем шаги
    const state = await SetupState.findByPk('singleton');
    const steps = [...(state.completedSteps || [])];
    if (!steps.includes('storage')) {
      steps.push('storage');
    }
    await state.update({ completedSteps: steps });

    res.json({
      data: { success: true, step: 'storage', message: `Хранилище настроено: ${resolvedPath}` }
    });
  } catch (err) {
    res.status(400).json({
      error: {
        code: 'STORAGE_ERROR',
        message: `Ошибка настройки хранилища: ${err.message}`
      }
    });
  }
}

/**
 * POST /api/setup/step/complete
 * Шаг 4: Завершение настройки
 */
export async function stepComplete(req, res) {
  try {
    const { SetupState, User, SystemSettings } = getModels();

    const state = await SetupState.findByPk('singleton');
    const steps = state?.completedSteps || [];

    // Проверяем все шаги
    const required = ['database', 'admin', 'storage'];
    const missing = required.filter(s => !steps.includes(s));

    if (missing.length > 0) {
      return res.status(400).json({
        error: {
          code: 'STEPS_INCOMPLETE',
          message: `Не завершены шаги: ${missing.join(', ')}`
        }
      });
    }

    // Создаём дефолтные настройки
    const defaults = [
      { key: 'registration.enabled', value: true },
      { key: 'app.name', value: 'GDD Support System' },
      { key: 'storage.maxFileSize', value: 52428800 }, // 50 MB
      { key: 'tickets.autoCloseAfterDays', value: 7 },
      { key: 'grouping.similarityThreshold', value: 0.75 }
    ];

    for (const { key, value } of defaults) {
      await SystemSettings.findOrCreate({
        where: { key },
        defaults: { value }
      });
    }

    // Завершаем Setup
    await state.update({
      isComplete: true,
      completedSteps: [...steps, 'complete'],
      completedAt: new Date()
    });

    // Записываем JWT_SECRET в .env (чтобы токены работали после перезапуска)
    _writeEnv('JWT_SECRET', process.env.JWT_SECRET);

    // Сбрасываем кэш setupGuard
    resetSetupCache();
    await checkSetupState();
    await initVapid();

    // Генерируем JWT для админа (автологин)
    const admin = await User.findOne({ where: { isRootAdmin: true } });

    const accessToken = jwt.sign(
      {
        sub: admin.id,
        role: admin.role,
        login: admin.login,
        isRootAdmin: true
      },
      process.env.JWT_SECRET || 'default-secret-change-me',
      { expiresIn: '15m' }
    );

    res.json({
      data: {
        success: true,
        step: 'complete',
        message: 'Настройка завершена!',
        accessToken,
        user: {
          id: admin.id,
          login: admin.login,
          displayName: admin.displayName,
          role: admin.role,
          isRootAdmin: true
        }
      }
    });
  } catch (err) {
    throw err;
  }
}

/**
 * Записывает переменную в .env файл (backend/.env)
 */
function _writeEnv(key, value) {
  const envPath = path.resolve(process.cwd(), '.env');
  let content = '';

  try {
    content = fs.readFileSync(envPath, 'utf8');
  } catch {
    // файла нет — создадим
  }

  const regex = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}=${value}`;

  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    content += (content && !content.endsWith('\n') ? '\n' : '') + line + '\n';
  }

  fs.writeFileSync(envPath, content, 'utf8');
}
