import { lazy } from 'react';
import { Navigate } from 'react-router';

import { CONFIG } from 'src/global-config';

import { authRoutes } from './auth';
import { mainRoutes } from './main';
import { dashboardRoutes } from './dashboard';

// ----------------------------------------------------------------------

const Page404 = lazy(() => import('src/pages/error/404'));

export const routesSection = [
  // Redirige "/" → dashboard (y el AuthGuard lleva al login si no hay sesión)
  { path: '/', element: <Navigate to={CONFIG.auth.redirectPath} replace /> },

  // Auth
  ...authRoutes,

  // Dashboard
  ...dashboardRoutes,

  // Errores y utilitarios
  ...mainRoutes,

  // No match
  { path: '*', element: <Page404 /> },
];
