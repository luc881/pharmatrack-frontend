import 'src/global.css';

import { useEffect } from 'react';

import { usePathname } from 'src/routes/hooks';

import { LocalizationProvider } from 'src/locales';
import { themeConfig, ThemeProvider } from 'src/theme';
import { I18nProvider } from 'src/locales/i18n-provider';

import { Snackbar } from 'src/components/snackbar';
import { ProgressBar } from 'src/components/progress-bar';
import { MotionLazy } from 'src/components/animate/motion-lazy';
import { SettingsDrawer, defaultSettings, SettingsProvider } from 'src/components/settings';

import { useAuthContext } from 'src/auth/hooks';
import { AuthProvider as JwtAuthProvider } from 'src/auth/context/jwt';

// ----------------------------------------------------------------------

const AuthProvider = JwtAuthProvider;

// ----------------------------------------------------------------------

function UserSettingsProvider({ children }) {
  const { user } = useAuthContext();
  const storageKey = `app-settings-${user?.id ?? 'guest'}`;
  return (
    <SettingsProvider defaultSettings={defaultSettings} storageKey={storageKey}>
      {children}
    </SettingsProvider>
  );
}

// ----------------------------------------------------------------------

export default function App({ children }) {
  useScrollToTop();

  return (
    <I18nProvider>
      <AuthProvider>
        <UserSettingsProvider>
          <LocalizationProvider>
            <ThemeProvider
              modeStorageKey={themeConfig.modeStorageKey}
              defaultMode={themeConfig.defaultMode}
            >
              <MotionLazy>
                <Snackbar />
                <ProgressBar />
                <SettingsDrawer defaultSettings={defaultSettings} />
                {children}
              </MotionLazy>
            </ThemeProvider>
          </LocalizationProvider>
        </UserSettingsProvider>
      </AuthProvider>
    </I18nProvider>
  );
}

// ----------------------------------------------------------------------

function useScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
