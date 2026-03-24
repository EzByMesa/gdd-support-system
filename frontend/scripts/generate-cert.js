/**
 * Генерация самоподписанного SSL-сертификата для разработки.
 * Включает localhost + все локальные IP адреса.
 *
 * Запуск: node frontend/scripts/generate-cert.js
 */
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { networkInterfaces } from 'os';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const certDir = resolve(__dirname, '..', '.cert');

// Собираем все локальные IP
const localIPs = new Set(['127.0.0.1']);
const ifaces = networkInterfaces();
for (const ifaceList of Object.values(ifaces)) {
  for (const iface of ifaceList) {
    if (!iface.internal && iface.family === 'IPv4') {
      localIPs.add(iface.address);
    }
  }
}

const ips = [...localIPs];
console.log('IP адреса:', ips.join(', '));

// Генерация через Node.js crypto (X509)
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

// SAN extension: DNS:localhost + IP:xxx для каждого IP
const sanEntries = ['DNS:localhost', ...ips.map(ip => `IP:${ip}`)];

const cert = crypto.createSelfSignedCertificate
  ? null // Node 21+ has this but let's use openssl approach
  : null;

// Используем openssl если доступен, иначе fallback
mkdirSync(certDir, { recursive: true });
const keyPath = resolve(certDir, 'key.pem');
const certPath = resolve(certDir, 'cert.pem');

// Пишем private key
writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));

// Создаём конфиг для openssl
const opensslConf = `[req]
distinguished_name = req_dn
x509_extensions = v3_req
prompt = no

[req_dn]
CN = GDD Support Dev

[v3_req]
subjectAltName = ${sanEntries.join(',')}
`;

const confPath = resolve(certDir, 'openssl.cnf');
writeFileSync(confPath, opensslConf);

try {
  execSync(
    `openssl req -new -x509 -key "${keyPath}" -out "${certPath}" -days 365 -config "${confPath}"`,
    { stdio: 'pipe' }
  );
  console.log(`\nСертификат создан: ${certDir}/`);
  console.log(`SAN: ${sanEntries.join(', ')}`);
} catch {
  // Openssl не найден — генерируем простой сертификат без SAN через basic-ssl
  console.log('\nopenssl не найден — используем @vitejs/plugin-basic-ssl');
  console.log('Push будет работать только через https://localhost:5173');
}
