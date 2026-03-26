import 'dotenv/config';

// JWT_SECRET обязателен — генерируем и сохраняем в .env если не задан
if (!process.env.JWT_SECRET) {
  const { randomBytes } = await import('crypto');
  const { appendFileSync, existsSync, readFileSync } = await import('fs');
  const { resolve } = await import('path');

  const secret = randomBytes(32).toString('hex');
  process.env.JWT_SECRET = secret;

  // Сохраняем в .env, чтобы секрет не менялся при рестарте
  const envPath = resolve(process.cwd(), '.env');
  try {
    const envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
    if (!envContent.includes('JWT_SECRET=')) {
      appendFileSync(envPath, `${envContent && !envContent.endsWith('\n') ? '\n' : ''}JWT_SECRET=${secret}\n`);
      console.log('[Auth] JWT_SECRET сгенерирован и сохранён в .env');
    }
  } catch {
    console.log('[Auth] JWT_SECRET сгенерирован (не удалось сохранить в .env)');
  }
}

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { initDatabase } from './models/index.js';
import { setupGuard, checkSetupState } from './middleware/setupGuard.js';
import { errorHandler } from './middleware/errorHandler.js';
import setupRoutes from './setup/setupRoutes.js';
import authRoutes from './routes/authRoutes.js';
import ticketRoutes, { attachmentRouter } from './routes/ticketRoutes.js';
import delegationRoutes from './routes/delegationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import topicGroupRoutes from './routes/topicGroupRoutes.js';
import notificationRoutes, { pushRouter } from './routes/notificationRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import knowledgeRoutes from './routes/knowledgeRoutes.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/swagger.js';
import { authenticate, requireAdmin } from './middleware/auth.js';
import { initWebSocket } from './websocket/wsServer.js';
import { initVapid } from './services/notification.js';
import { initSmtp } from './services/email.js';

const app = express();
const server = createServer(app);

// --- Middleware ---
app.use(cors({
  origin: process.env.FRONTEND_URL || [
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'https://localhost:5173', 'https://127.0.0.1:5173'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 300, // макс 300 запросов с одного IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Слишком много запросов. Попробуйте позже.' } }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // строже для auth
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Слишком много попыток. Попробуйте через 15 минут.' } }
});
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Setup guard — блокирует все запросы кроме /api/setup если система не настроена
app.use(setupGuard);

// --- Routes ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/setup', setupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/attachments', attachmentRouter);
app.use('/api/delegations', delegationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/topic-groups', topicGroupRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/push', pushRouter);
app.use('/api/profile', profileRoutes);
app.use('/api/knowledge', knowledgeRoutes);

// Swagger — доступ через cookie (для админки, read-only)
import jwt from 'jsonwebtoken';

function swaggerCookieAuth(req, res, next) {
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).send('Войдите в систему как администратор');
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'refresh') throw new Error();
    // Проверяем роль через БД
    import('./models/index.js').then(({ getModels }) => {
      const { User } = getModels();
      User.findByPk(payload.sub).then(user => {
        if (!user || user.role !== 'ADMIN') {
          return res.status(403).send('Только для администраторов');
        }
        next();
      });
    });
  } catch {
    return res.status(401).send('Сессия истекла. Войдите заново.');
  }
}

app.use('/api/docs', swaggerCookieAuth, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none } .swagger-ui .try-out { display: none }',
  customSiteTitle: 'GDD Support API — Документация',
  swaggerOptions: { supportedSubmitMethods: [] } // отключает "Try it out"
}));
app.get('/api/docs.json', swaggerCookieAuth, (req, res) => res.json(swaggerSpec));

// --- Standalone mode: serve frontend dist ---
if (process.env.SERVE_STATIC === 'true' || process.env.NODE_ENV === 'production') {
  const { resolve } = await import('path');
  const { existsSync } = await import('fs');
  const distPath = resolve(process.cwd(), '..', 'frontend', 'dist');
  if (existsSync(distPath)) {
    app.use(express.static(distPath));
    // SPA fallback — все не-API запросы → index.html
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
      res.sendFile(resolve(distPath, 'index.html'));
    });
    console.log(`[Server] Раздача фронтенда из ${distPath}`);
  }
}

// --- Error handler ---
app.use(errorHandler);

// --- Start ---
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // Если есть DATABASE_URL — подключаемся к БД
    if (process.env.DATABASE_URL) {
      const dialect = process.env.DB_DIALECT || (process.env.DATABASE_URL.startsWith('postgres') ? 'postgres' : 'sqlite');
      const { sequelize } = initDatabase(process.env.DATABASE_URL, { dialect });
      await sequelize.authenticate();
      console.log(`[DB] Подключение к ${dialect === 'sqlite' ? 'SQLite' : 'PostgreSQL'} установлено`);
      // Обновляем схему БД
      if (dialect === 'sqlite') {
        // SQLite не поддерживает ALTER TABLE нормально — добавляем колонки вручную
        await sequelize.query('PRAGMA foreign_keys = OFF;');
        const safeAddColumn = async (table, col, type, dflt) => {
          try {
            const def = dflt !== undefined ? ` DEFAULT ${dflt}` : '';
            await sequelize.query(`ALTER TABLE "${table}" ADD COLUMN "${col}" ${type}${def};`);
            console.log(`[DB] Добавлена колонка ${table}.${col}`);
          } catch { /* уже существует */ }
        };
        await safeAddColumn('tickets', 'closedReason', 'TEXT');
        await safeAddColumn('tickets', 'customFields', 'TEXT');
        await safeAddColumn('users', 'verifiedEmail', 'VARCHAR(255)');
        await safeAddColumn('ticket_messages', 'isSystem', 'BOOLEAN', 0);
        await safeAddColumn('tickets', 'createdById', 'VARCHAR(36)');
        await safeAddColumn('users', 'avatarPath', 'VARCHAR(255)');

        // Починка: сломанный unique index на agent_aliases (agentId вместо agentId+ticketId)
        try {
          // Удаляем неправильный индекс и создаём правильный composite
          await sequelize.query('DROP INDEX IF EXISTS "agent_aliases_agent_id_ticket_id"');
          await sequelize.query('DROP INDEX IF EXISTS "agent_aliases_agentId_ticketId"');
          await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "agent_aliases_agent_id_ticket_id" ON "agent_aliases" ("agentId", "ticketId")');
          console.log('[DB] Индекс agent_aliases исправлен');
        } catch (e) { console.warn('[DB] Индекс agent_aliases:', e.message); }

        // Создаём новые таблицы (если не существуют)
        await sequelize.sync();
        await sequelize.query('PRAGMA foreign_keys = ON;');
      } else {
        // PostgreSQL: добавляем новые ENUM значения перед sync
        try {
          await sequelize.query(`ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'SENIOR_AGENT'`);
        } catch { /* тип может не существовать или значение уже есть */ }
        await sequelize.sync({ alter: true });
      }
      await checkSetupState();
      await initVapid();
      await initSmtp();
    } else {
      console.log('[DB] DATABASE_URL не задан — ожидаем настройку через Setup Wizard');
    }

    // WebSocket
    initWebSocket(server);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] GDD Support System запущен на http://127.0.0.1:${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Ошибка запуска:', err.message, err.errors || '', err.stack);
    process.exit(1);
  }
}

start();

export { app, server };
