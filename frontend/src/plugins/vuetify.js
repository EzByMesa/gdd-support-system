import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import '@fortawesome/fontawesome-free/css/all.css';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

/**
 * Единая тёмная тема — приглушённые, спокойные цвета.
 */
const gddDark = {
  dark: true,
  colors: {
    background: '#121318',
    surface: '#1C1D25',
    'surface-bright': '#24252F',
    'surface-light': '#2A2B36',
    'surface-variant': '#2A2B36',
    'on-surface': '#E0DDD8',
    'on-surface-variant': '#9E9A93',
    primary: '#8B9DC3',
    'primary-darken-1': '#7689B0',
    secondary: '#7E8A80',
    'secondary-darken-1': '#6B766D',
    accent: '#B09AC5',
    success: '#7EA87E',
    warning: '#C9A96E',
    error: '#BF7B7B',
    info: '#7E9BB5',
  }
};

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'gddDark',
    themes: { gddDark }
  },
  defaults: {
    VBtn: {
      rounded: 'lg',
      elevation: 0,
    },
    VTextField: {
      variant: 'outlined',
      density: 'default',
      color: 'primary',
    },
    VSelect: {
      variant: 'outlined',
      density: 'default',
      color: 'primary',
    },
    VTextarea: {
      variant: 'outlined',
      density: 'default',
      color: 'primary',
    },
    VCard: {
      rounded: 'lg',
      elevation: 0,
      color: 'surface',
    },
    VChip: {
      size: 'small',
      rounded: 'lg',
      variant: 'tonal',
    },
    VDialog: {
      maxWidth: 560,
    },
    VNavigationDrawer: {
      elevation: 0,
    },
    VAppBar: {
      elevation: 0,
      flat: true,
    },
    VSwitch: {
      color: 'primary',
      inset: true,
    },
  }
});
