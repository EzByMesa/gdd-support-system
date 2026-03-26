import { createApp } from 'vue';
import { createPinia } from 'pinia';
import vuetify from './plugins/vuetify.js';
import App from './App.vue';
import { router } from './router/index.js';
import { loadConfig } from './config.js';

import './styles/app.css';

// Загружаем конфиг из /config.json ДО монтирования приложения
loadConfig().then(() => {
  const app = createApp(App);
  app.use(createPinia());
  app.use(vuetify);
  app.use(router);
  app.mount('#app');
});
