/**
 * Сервис отправки email через SMTP.
 * Настройки берутся из SystemSettings.
 */
import { createTransport } from 'nodemailer';
import { getModels } from '../models/index.js';

let transporter = null;
let smtpConfigured = false;

/**
 * Инициализация SMTP транспорта из настроек БД.
 */
export async function initSmtp() {
  try {
    const { SystemSettings } = getModels();
    const settings = await SystemSettings.findAll({
      where: {
        key: ['smtp.host', 'smtp.port', 'smtp.user', 'smtp.pass', 'smtp.from', 'smtp.secure']
      }
    });

    const cfg = {};
    for (const s of settings) {
      cfg[s.key] = s.value;
    }

    if (!cfg['smtp.host'] || !cfg['smtp.port']) {
      console.log('[Email] SMTP не настроен — email-уведомления отключены');
      return;
    }

    transporter = createTransport({
      host: cfg['smtp.host'],
      port: parseInt(cfg['smtp.port']),
      secure: cfg['smtp.secure'] === true || cfg['smtp.secure'] === 'true',
      auth: (cfg['smtp.user'] && cfg['smtp.pass']) ? {
        user: cfg['smtp.user'],
        pass: cfg['smtp.pass']
      } : undefined
    });

    smtpConfigured = true;
    console.log(`[Email] SMTP настроен: ${cfg['smtp.host']}:${cfg['smtp.port']}`);
  } catch (err) {
    console.error('[Email] Ошибка инициализации SMTP:', err.message);
  }
}

/**
 * Перезагрузить SMTP конфигурацию (после изменения настроек в админке).
 */
export async function reloadSmtp() {
  transporter = null;
  smtpConfigured = false;
  await initSmtp();
}

/**
 * Проверить SMTP соединение.
 */
export async function testSmtp() {
  if (!transporter) throw new Error('SMTP не настроен');
  await transporter.verify();
  return true;
}

/**
 * Отправить email.
 */
export async function sendEmail(to, subject, html) {
  if (!smtpConfigured || !transporter) return false;

  const { SystemSettings } = getModels();
  const fromSetting = await SystemSettings.findOne({ where: { key: 'smtp.from' } });
  const from = fromSetting?.value || 'noreply@gdd-support.local';

  try {
    await transporter.sendMail({ from, to, subject, html });
    return true;
  } catch (err) {
    console.error(`[Email] Ошибка отправки на ${to}:`, err.message);
    return false;
  }
}

/**
 * Отправить код подтверждения email.
 */
export async function sendVerificationCode(to, code) {
  return sendEmail(
    to,
    'Код подтверждения — GDD Support',
    `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;">
      <h2 style="color:#5B8DB8">GDD Support System</h2>
      <p>Ваш код подтверждения:</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:4px;text-align:center;padding:16px;background:#f5f5f5;border-radius:8px;margin:16px 0">${code}</div>
      <p style="color:#666;font-size:14px">Код действителен 10 минут. Если вы не запрашивали подтверждение — проигнорируйте это письмо.</p>
    </div>`
  );
}

/**
 * Отправить уведомление на email.
 */
export async function sendNotificationEmail(to, title, body, ticketNumber) {
  return sendEmail(
    to,
    `${title} — GDD Support`,
    `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
      <h3 style="color:#5B8DB8">${title}</h3>
      <p>${body}</p>
      ${ticketNumber ? `<p style="color:#666;font-size:14px">Обращение #${ticketNumber}</p>` : ''}
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
      <p style="color:#999;font-size:12px">GDD Support System</p>
    </div>`
  );
}

export function isSmtpConfigured() {
  return smtpConfigured;
}
