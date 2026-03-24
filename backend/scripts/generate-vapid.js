#!/usr/bin/env node
/**
 * Генерация VAPID ключей для тестирования Web Push.
 * Запуск: node backend/scripts/generate-vapid.js
 *
 * VAPID ключи автоматически генерируются при первом запуске сервера,
 * но этот скрипт можно использовать для ручной генерации.
 */
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('=== VAPID Keys ===');
console.log(`Public Key:  ${keys.publicKey}`);
console.log(`Private Key: ${keys.privateKey}`);
console.log('');
console.log('Добавьте в backend/.env:');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('');
console.log('Или они будут автоматически сохранены в БД при первом запуске.');
