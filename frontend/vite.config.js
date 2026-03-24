import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const certDir = resolve(__dirname, '.cert');

// Используем сгенерированный сертификат если есть, иначе без HTTPS
let httpsConfig = false;
if (existsSync(resolve(certDir, 'cert.pem')) && existsSync(resolve(certDir, 'key.pem'))) {
  httpsConfig = {
    key: readFileSync(resolve(certDir, 'key.pem')),
    cert: readFileSync(resolve(certDir, 'cert.pem')),
  };
  console.log('[Vite] HTTPS включён (сертификат из .cert/)');
}

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true })
  ],
  root: '.',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: httpsConfig,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false
      },
      '/ws': {
        target: 'ws://127.0.0.1:3000',
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
