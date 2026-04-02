// ----------------------------------------------------------------------

export const SETTINGS_STORAGE_KEY = 'app-settings';

// Bump this number whenever defaults change to force a reset on existing browsers.
const SETTINGS_VERSION = '2';

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
  version: SETTINGS_VERSION,
};
