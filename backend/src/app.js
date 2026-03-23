import 'dotenv/config';

// JWT_SECRET обязателен — генерируем дефолтный для dev если не задан
if (!process.env.JWT_SECRET) {
  const { randomBytes } = await import('crypto');
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  console.log('[Auth] JWT_SECRET не задан — сгенерирован автоматически (dev-режим)');
}

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
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
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/swagger.js';
import { authenticate, requireAdmin } from './middleware/auth.js';
import { initWebSocket } from './websocket/wsServer.js';
import { initVapid } from './services/notification.js';

const app = express();
const server = createServer(app);

// --- Middleware ---
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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
      await checkSetupState();
      await initVapid();
    } else {
      console.log('[DB] DATABASE_URL не задан — ожидаем настройку через Setup Wizard');
    }

    // WebSocket
    initWebSocket(server);

    server.listen(PORT, () => {
      console.log(`[Server] GDD Support System запущен на порту ${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Ошибка запуска:', err.message);
    process.exit(1);
  }
}

start();

export { app, server };
