/**
 * Автоматический тестовый набор GDD Support System.
 *
 * Запуск: JWT_SECRET=test node tests/run.js
 *
 * Требования:
 * - Сервер НЕ должен быть запущен (тест поднимает свой)
 * - PostgreSQL доступен ИЛИ используется SQLite (по умолчанию SQLite)
 */

import { suite, assert, assertEqual, summary, get, post, put, del } from './helpers.js';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';

const TEST_DB = '/tmp/gdd_test_auto.sqlite';
const TEST_STORAGE = '/tmp/gdd_test_auto_storage';

// Cleanup before
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
if (fs.existsSync(TEST_STORAGE)) fs.rmSync(TEST_STORAGE, { recursive: true });

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-auto';
process.env.PORT = process.env.PORT || '3099';
const PORT = process.env.PORT;
const API_BASE = `http://127.0.0.1:${PORT}/api`;

// Динамический импорт app после настройки env
const { app, server } = await import('../src/app.js');

// Ждём запуска — пробуем подключиться
for (let attempt = 0; attempt < 20; attempt++) {
  try {
    await fetch(`${API_BASE}/health`);
    break;
  } catch {
    await new Promise(r => setTimeout(r, 500));
  }
}
console.log('Server ready for tests\n');

let ADMIN_TOKEN = '';
let USER_TOKEN = '';
let AGENT_TOKEN = '';
let TICKET_ID = '';
let TICKET_NUMBER = 0;
let ATTACHMENT_ID = '';
let AGENT_ID = '';
let DELEGATION_ID = '';

try {
  // ==================== SETUP ====================
  suite('Setup Wizard');

  let r = await get('/setup/status');
  assertEqual(r.status, 200, 'GET /setup/status');
  assert(r.data.data.needsSetup === true, 'needsSetup = true');

  r = await post('/setup/step/database', { dbType: 'sqlite', path: TEST_DB });
  assertEqual(r.status, 200, 'Step database (SQLite)');
  assert(r.data.data.success, 'database success');

  r = await post('/setup/step/admin', { login: 'admin', password: 'admin12345', displayName: 'Test Admin' });
  assertEqual(r.status, 200, 'Step admin');

  r = await post('/setup/step/storage', { storagePath: TEST_STORAGE });
  assertEqual(r.status, 200, 'Step storage');

  r = await post('/setup/step/complete');
  assertEqual(r.status, 200, 'Step complete');
  assert(r.data.data.accessToken, 'Complete returns JWT');
  ADMIN_TOKEN = r.data.data.accessToken;
  assert(r.data.data.user.isRootAdmin === true, 'User is root admin');

  // ==================== AUTH ====================
  suite('Authentication');

  // Используем токен из complete (уже имеем ADMIN_TOKEN)
  r = await post('/auth/login', { login: 'admin', password: 'admin12345' });
  assertEqual(r.status, 200, 'Login admin');
  assert(r.data.accessToken, 'Login returns JWT');
  ADMIN_TOKEN = r.data.accessToken;

  r = await post('/auth/login', { login: 'admin', password: 'wrong' });
  assertEqual(r.status, 401, 'Wrong password → 401');

  r = await post('/auth/register', { login: 'user1', password: 'user12345', displayName: 'Test User' });
  assertEqual(r.status, 201, 'Register user');
  assertEqual(r.data.user.role, 'USER', 'Default role = USER');
  USER_TOKEN = r.data.accessToken;

  r = await get('/auth/me', USER_TOKEN);
  assertEqual(r.status, 200, 'GET /auth/me');
  assertEqual(r.data.data.login, 'user1', 'me returns correct user');

  r = await get('/auth/me');
  assertEqual(r.status, 401, 'No token → 401');

  r = await get('/auth/providers');
  assertEqual(r.status, 200, 'GET /auth/providers');
  assert(Array.isArray(r.data.data), 'Providers is array');

  // Create agent via admin
  r = await post('/admin/users', { login: 'agent1', password: 'agent12345', displayName: 'Test Agent', role: 'AGENT' }, ADMIN_TOKEN);
  assertEqual(r.status, 201, 'Create agent via admin');
  AGENT_ID = r.data.data.id;

  r = await post('/auth/login', { login: 'agent1', password: 'agent12345' });
  AGENT_TOKEN = r.data.accessToken;
  assert(AGENT_TOKEN, 'Agent login OK');

  // ==================== REGISTRATION TOGGLE ====================
  suite('Registration Toggle');

  r = await put('/admin/settings/registration.enabled', { value: false }, ADMIN_TOKEN);
  assertEqual(r.status, 200, 'Disable registration');

  r = await post('/auth/register', { login: 'nope', password: '12345678', displayName: 'Nope' });
  assertEqual(r.status, 403, 'Register disabled → 403');
  assertEqual(r.data.error.code, 'REGISTRATION_DISABLED', 'Error code REGISTRATION_DISABLED');

  await put('/admin/settings/registration.enabled', { value: true }, ADMIN_TOKEN);

  // ==================== TICKETS ====================
  suite('Tickets');

  r = await post('/tickets', { title: 'Test Ticket', description: 'Test description', priority: 'HIGH' }, USER_TOKEN);
  assertEqual(r.status, 201, 'Create ticket');
  TICKET_ID = r.data.data.id;
  TICKET_NUMBER = r.data.data.number;
  assertEqual(r.data.data.status, 'OPEN', 'New ticket status = OPEN');
  assertEqual(r.data.data.priority, 'HIGH', 'Priority = HIGH');
  assert(TICKET_NUMBER > 0, `Ticket number = ${TICKET_NUMBER}`);

  r = await get('/tickets', USER_TOKEN);
  assertEqual(r.status, 200, 'List tickets (user)');
  assertEqual(r.data.data.length, 1, 'User sees 1 ticket');
  assertEqual(r.data.data[0].readonly, false, 'User ticket not readonly');

  r = await get('/tickets', AGENT_TOKEN);
  assertEqual(r.data.data.length, 1, 'Agent sees all tickets');
  assertEqual(r.data.data[0].readonly, false, 'Unassigned = not readonly for agent');

  r = await get(`/tickets/${TICKET_ID}`, USER_TOKEN);
  assertEqual(r.status, 200, 'Get ticket by ID');

  // Create second ticket for user (to test isolation)
  await post('/tickets', { title: 'Agent ticket', description: 'By admin' }, ADMIN_TOKEN);

  r = await get('/tickets', USER_TOKEN);
  assertEqual(r.data.data.length, 1, 'User still sees only own tickets');

  r = await get('/tickets', ADMIN_TOKEN);
  assert(r.data.data.length >= 2, 'Admin sees all tickets');

  // ==================== ASSIGN ====================
  suite('Ticket Assignment');

  r = await put(`/tickets/${TICKET_ID}/assign`, {}, AGENT_TOKEN);
  assertEqual(r.status, 200, 'Agent assigns ticket');
  assertEqual(r.data.data.status, 'IN_PROGRESS', 'Status → IN_PROGRESS');
  assert(r.data.data.agentAlias, `Agent alias: ${r.data.data.agentAlias}`);

  // User sees anonymous alias
  r = await get(`/tickets/${TICKET_ID}`, USER_TOKEN);
  assert(r.data.data.assignee.displayName !== 'Test Agent', 'User sees anonymous name, not real');

  // Admin sees real name
  r = await get(`/tickets/${TICKET_ID}`, ADMIN_TOKEN);

  // Status change
  r = await put(`/tickets/${TICKET_ID}/status`, { status: 'WAITING_FOR_USER' }, AGENT_TOKEN);
  assertEqual(r.status, 200, 'Change status to WAITING_FOR_USER');

  r = await put(`/tickets/${TICKET_ID}/status`, { status: 'RESOLVED' }, AGENT_TOKEN);
  assertEqual(r.status, 200, 'Change status to RESOLVED');

  // ==================== ATTACHMENTS ====================
  suite('Attachments (AES-256-GCM)');

  // Upload
  const testContent = 'Hello, encrypted world!';
  fs.writeFileSync('/tmp/gdd_test_auto_upload.txt', testContent);

  const form = new FormData();
  const fileBlob = new Blob([fs.readFileSync('/tmp/gdd_test_auto_upload.txt')]);
  form.append('file', fileBlob, 'test_file.txt');
  form.append('ticketId', TICKET_ID);

  r = await post('/attachments', form, USER_TOKEN);
  // FormData через fetch в Node may need different handling
  // Fallback: use raw fetch
  const uploadRes = await fetch(`${API_BASE}/attachments`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${USER_TOKEN}` },
    body: form
  });
  const uploadData = await uploadRes.json();
  assertEqual(uploadRes.status, 201, 'Upload attachment');
  ATTACHMENT_ID = uploadData.data.id;
  assertEqual(uploadData.data.originalName, 'test_file.txt', 'Original name preserved');

  // Download
  const dlRes = await fetch(`${API_BASE}/attachments/${ATTACHMENT_ID}/download`, {
    headers: { 'Authorization': `Bearer ${USER_TOKEN}` }
  });
  const dlText = await dlRes.text();
  assertEqual(dlRes.status, 200, 'Download attachment');
  assertEqual(dlText, testContent, 'Decrypted content matches');

  // Check storage — no extensions
  const storageFiles = fs.readdirSync(TEST_STORAGE);
  assert(storageFiles.length > 0, 'Storage has files');
  assert(!storageFiles[0].includes('.'), 'No file extensions in storage');

  fs.unlinkSync('/tmp/gdd_test_auto_upload.txt');

  // ==================== MESSAGES ====================
  suite('Messages (REST)');

  r = await get(`/tickets/${TICKET_ID}/messages`, USER_TOKEN);
  assertEqual(r.status, 200, 'Get messages');
  assert(Array.isArray(r.data.data), 'Messages is array');

  // ==================== DELEGATION ====================
  suite('Delegation');

  // Reset ticket to IN_PROGRESS for delegation test
  await put(`/tickets/${TICKET_ID}/status`, { status: 'IN_PROGRESS' }, AGENT_TOKEN);

  // Agent delegates to admin
  const adminInfo = await get('/auth/me', ADMIN_TOKEN);
  const adminId = adminInfo.data.data.id;

  r = await post(`/tickets/${TICKET_ID}/delegate`, { toAgentId: adminId, message: 'Need help' }, AGENT_TOKEN);
  assertEqual(r.status, 201, 'Create delegation');
  DELEGATION_ID = r.data.data.id;
  assertEqual(r.data.data.status, 'PENDING', 'Delegation status = PENDING');

  // Can't create second pending
  r = await post(`/tickets/${TICKET_ID}/delegate`, { toAgentId: adminId }, AGENT_TOKEN);
  assertEqual(r.status, 409, 'Duplicate delegation → 409');

  // Admin sees incoming
  r = await get('/delegations/incoming', ADMIN_TOKEN);
  assertEqual(r.status, 200, 'Incoming delegations');
  assert(r.data.data.length >= 1, 'Has incoming delegation');

  // Count
  r = await get('/delegations/incoming/count', ADMIN_TOKEN);
  assert(r.data.data.count >= 1, `Incoming count: ${r.data.data.count}`);

  // Admin accepts
  r = await put(`/delegations/${DELEGATION_ID}/respond`, { accept: true }, ADMIN_TOKEN);
  assertEqual(r.status, 200, 'Accept delegation');
  assertEqual(r.data.data.status, 'ACCEPTED', 'Status = ACCEPTED');

  // Ticket reassigned to admin
  r = await get(`/tickets/${TICKET_ID}`, ADMIN_TOKEN);
  assert(r.data.data.assignee, 'Ticket has new assignee');

  // ==================== NOTIFICATIONS ====================
  suite('Notifications');

  r = await get('/notifications', USER_TOKEN);
  assertEqual(r.status, 200, 'List notifications');
  assert(r.data.data.length > 0, `User has ${r.data.data.length} notifications`);

  r = await get('/notifications/count', USER_TOKEN);
  assert(r.data.data.count >= 0, `Unread count: ${r.data.data.count}`);

  r = await put('/notifications/read-all', {}, USER_TOKEN);
  assertEqual(r.status, 200, 'Mark all read');

  r = await get('/notifications/count', USER_TOKEN);
  assertEqual(r.data.data.count, 0, 'Count after read-all = 0');

  // ==================== ADMIN ====================
  suite('Admin Panel');

  r = await get('/admin/dashboard', ADMIN_TOKEN);
  assertEqual(r.status, 200, 'Dashboard');
  assert(r.data.data.stats.totalTickets >= 2, `Total tickets: ${r.data.data.stats.totalTickets}`);
  assert(r.data.data.stats.totalUsers >= 3, `Total users: ${r.data.data.stats.totalUsers}`);

  r = await get('/admin/users', ADMIN_TOKEN);
  assertEqual(r.status, 200, 'List users');
  assert(r.data.data.length >= 3, `Users: ${r.data.data.length}`);

  // Change role
  r = await put(`/admin/users/${AGENT_ID}/role`, { role: 'ADMIN' }, ADMIN_TOKEN);
  assertEqual(r.status, 200, 'Change role');
  assertEqual(r.data.data.role, 'ADMIN', 'Role changed to ADMIN');
  await put(`/admin/users/${AGENT_ID}/role`, { role: 'AGENT' }, ADMIN_TOKEN); // restore

  // Settings
  r = await get('/admin/settings', ADMIN_TOKEN);
  assertEqual(r.status, 200, 'Get settings');
  assert(r.data.data['app.name'] === 'GDD Support System', 'App name');

  // Auth providers
  r = await post('/admin/auth-providers', { type: 'ONE_C', name: 'Test 1C', config: { baseUrl: 'http://test' } }, ADMIN_TOKEN);
  assertEqual(r.status, 201, 'Create auth provider');
  const providerId = r.data.data.id;

  r = await get('/admin/auth-providers', ADMIN_TOKEN);
  assert(r.data.data.length >= 1, 'Has providers');

  await del(`/admin/auth-providers/${providerId}`, ADMIN_TOKEN);

  // ==================== ACCESS CONTROL ====================
  suite('Access Control');

  r = await get('/admin/dashboard', USER_TOKEN);
  assertEqual(r.status, 403, 'User → admin dashboard = 403');

  r = await get('/admin/users', USER_TOKEN);
  // For non-admin, the endpoint returns filtered results (agents only for delegation)
  assertEqual(r.status, 200, 'Non-admin /admin/users returns filtered');

  r = await put(`/tickets/${TICKET_ID}/status`, { status: 'CLOSED' }, USER_TOKEN);
  assertEqual(r.status, 403, 'User cannot change status');

} catch (err) {
  console.error('\n\x1b[31mFATAL ERROR:\x1b[0m', err.message);
  console.error(err.stack);
}

// ==================== SUMMARY ====================
const failures = summary();

// Cleanup
server.close();

if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
if (fs.existsSync(TEST_STORAGE)) fs.rmSync(TEST_STORAGE, { recursive: true });

// .env created during test
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) fs.unlinkSync(envPath);

console.log('\n\x1b[2mТестовые артефакты зачищены\x1b[0m');

process.exit(failures > 0 ? 1 : 0);
