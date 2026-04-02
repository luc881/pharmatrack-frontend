import { CONFIG } from 'src/global-config';

// ----------------------------------------------------------------------

export const SETTINGS_STORAGE_KEY = 'app-settings';

export const defaultSettings = {
  mode: 'light',
  direction: 'ltr',
  contrast: 'high',
  navLayout: 'vertical',
  primaryColor: 'preset5',
  navColor: 'integrate',
  compactLayout: false,
  fontSize: 16,
  fontFamily: 'Inter Variable',
  version: CONFIG.appVersion,
};
