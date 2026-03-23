import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getModels } from '../models/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Получить мастер-ключ шифрования из SystemSettings
 */
async function getMasterKey() {
  const { SystemSettings } = getModels();
  const setting = await SystemSettings.findOne({ where: { key: 'storage.encryptionKey' } });
  if (!setting) throw new Error('Ключ шифрования не найден');
  // Ключ хранится как hex (64 символа = 32 байта)
  return Buffer.from(setting.value, 'hex');
}

/**
 * Получить путь к хранилищу
 */
async function getStoragePath() {
  const { SystemSettings } = getModels();
  const setting = await SystemSettings.findOne({ where: { key: 'storage.path' } });
  if (!setting) throw new Error('Путь хранилища не настроен');
  return setting.value;
}

/**
 * Зашифровать и сохранить файл.
 * @returns {{ storedName, encryptionIV }}
 */
export async function encryptAndStore(fileBuffer, storedName) {
  const masterKey = await getMasterKey();
  const storagePath = await getStoragePath();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Файл на диске: [authTag (16)] + [encrypted data]
  const fileData = Buffer.concat([authTag, encrypted]);
  const filePath = path.join(storagePath, storedName);

  fs.writeFileSync(filePath, fileData);

  return {
    storedName,
    encryptionIV: iv.toString('hex')
  };
}

/**
 * Расшифровать файл с диска.
 * @returns {Buffer}
 */
export async function decryptFile(storedName, encryptionIV) {
  const masterKey = await getMasterKey();
  const storagePath = await getStoragePath();

  const filePath = path.join(storagePath, storedName);
  const fileData = fs.readFileSync(filePath);

  const iv = Buffer.from(encryptionIV, 'hex');
  const authTag = fileData.subarray(0, AUTH_TAG_LENGTH);
  const encrypted = fileData.subarray(AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Удалить файл с диска
 */
export async function deleteStoredFile(storedName) {
  const storagePath = await getStoragePath();
  const filePath = path.join(storagePath, storedName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
