import { Outlet } from 'react-router';
import { lazy, Suspense } from 'react';

import { AuthSplitLayout } from 'src/layouts/auth-split';

import { SplashScreen } from 'src/components/loading-screen';

import { GuestGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

const SignInPage = lazy(() => import('src/pages/auth/jwt/sign-in'));
const SignUpPage = lazy(() => import('src/pages/auth/jwt/sign-up'));
const ForgotPasswordPage = lazy(() => import('src/pages/auth/jwt/forgot-password'));
const ResetPasswordPage = lazy(() => import('src/pages/auth/reset-password'));

// ----------------------------------------------------------------------

export const authRoutes = [
  {
    path: 'auth',
    element: (
      <Suspense fallback={<SplashScreen />}>
        <Outlet />
      </Suspense>
    ),
    children: [
      {
        path: 'jwt',
        children: [
          {
            path: 'sign-in',
            element: (
              <GuestGuard>
                <AuthSplitLayout slotProps={{ section: { title: 'Bienvenido de vuelta' } }}>
                  <SignInPage />
                </AuthSplitLayout>
              </GuestGuard>
            ),
          },
          {
            path: 'sign-up',
            element: (
              <GuestGuard>
                <AuthSplitLayout>
                  <SignUpPage />
                </AuthSplitLayout>
              </GuestGuard>
            ),
          },
          {
            path: 'forgot-password',
            element: (
              <GuestGuard>
                <AuthSplitLayout>
                  <ForgotPasswordPage />
                </AuthSplitLayout>
              </GuestGuard>
            ),
          },
        ],
      },
      {
        path: 'reset-password',
        element: (
          <AuthSplitLayout>
            <ResetPasswordPage />
          </AuthSplitLayout>
        ),
      },
    ],
  },
];
