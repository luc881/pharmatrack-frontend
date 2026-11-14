import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// eslint-disable-next-line import/no-unresolved -- módulo virtual de vite-plugin-pwa
import { registerSW } from 'virtual:pwa-register';
import { Outlet, RouterProvider, createBrowserRouter } from 'react-router';

import { toast } from 'src/components/snackbar';

import App from './app';
import { CONFIG } from './global-config';
import { routesSection } from './routes/sections';
import { ErrorBoundary } from './routes/components';

// ----------------------------------------------------------------------

// Avisos de errores: solo si la instalación trae VITE_SENTRY_DSN. Se carga
// aparte para no engordar el arranque de quien no lo usa.
if (import.meta.env.VITE_SENTRY_DSN) {
  import('@sentry/react').then((Sentry) =>
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      sendDefaultPii: false,
      initialScope: { tags: { app: CONFIG.appName } },
    })
  );
}

// Versión nueva ya descargada: se avisa y el usuario decide cuándo recargar
const updateApp = registerSW({
  onNeedRefresh() {
    toast.info('Hay una versión nueva de la app', {
      duration: Infinity,
      action: { label: 'Actualizar', onClick: () => updateApp(true) },
    });
  },
});

const router = createBrowserRouter([
  {
    Component: () => (
      <App>
        <Outlet />
      </App>
    ),
    errorElement: <ErrorBoundary />,
    children: routesSection,
  },
]);

const root = createRoot(document.getElementById('root'));

root.render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
