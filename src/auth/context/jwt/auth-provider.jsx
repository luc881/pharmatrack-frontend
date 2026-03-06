import { useSetState } from 'minimal-shared/hooks';
import { useMemo, useEffect, useCallback } from 'react';

import axios, { endpoints } from 'src/lib/axios';

import { JWT_STORAGE_KEY, JWT_REFRESH_KEY, JWT_REMEMBER_KEY } from './constant';
import { AuthContext } from '../auth-context';
import { jwtDecode, setSession, isValidToken } from './utils';

// ----------------------------------------------------------------------

/**
 * NOTE:
 * We only build demo at basic level.
 * Customer will need to do some extra handling yourself if you want to extend the logic and other features...
 */

export function AuthProvider({ children }) {
  const { state, setState } = useSetState({ user: null, loading: true });

  const checkUserSession = useCallback(async () => {
    try {
      const accessToken = sessionStorage.getItem(JWT_STORAGE_KEY);

      if (accessToken && isValidToken(accessToken)) {
        await setSession(accessToken);

        const decoded = jwtDecode(accessToken);
        const user = {
          id: decoded.id,
          email: decoded.sub,
          role: decoded.role,
          displayName: decoded.sub,
        };
        setState({ user: { ...user, accessToken }, loading: false });
        return;
      }

      // Sin access token válido: intentar renovar con refresh token (remember me)
      const refreshToken =
        sessionStorage.getItem(JWT_REFRESH_KEY) || localStorage.getItem(JWT_REFRESH_KEY);

      if (refreshToken) {
        const res = await axios.post(endpoints.auth.refresh, { refresh_token: refreshToken });
        const { access_token, refresh_token: newRefreshToken } = res.data;

        const rememberMe = localStorage.getItem(JWT_REMEMBER_KEY) === 'true';
        if (newRefreshToken) {
          if (rememberMe) {
            localStorage.setItem(JWT_REFRESH_KEY, newRefreshToken);
          } else {
            sessionStorage.setItem(JWT_REFRESH_KEY, newRefreshToken);
          }
        }

        await setSession(access_token);

        const decoded = jwtDecode(access_token);
        const user = {
          id: decoded.id,
          email: decoded.sub,
          role: decoded.role,
          displayName: decoded.sub,
        };
        setState({ user: { ...user, accessToken: access_token }, loading: false });
        return;
      }

      setState({ user: null, loading: false });
    } catch (error) {
      console.error(error);
      setState({ user: null, loading: false });
    }
  }, [setState]);

  useEffect(() => {
    checkUserSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------------------------------------------

  const checkAuthenticated = state.user ? 'authenticated' : 'unauthenticated';

  const status = state.loading ? 'loading' : checkAuthenticated;

  const memoizedValue = useMemo(
    () => ({
      user: state.user ? { ...state.user, role: state.user?.role ?? 'admin' } : null,
      checkUserSession,
      loading: status === 'loading',
      authenticated: status === 'authenticated',
      unauthenticated: status === 'unauthenticated',
    }),
    [checkUserSession, state.user, status]
  );

  return <AuthContext value={memoizedValue}>{children}</AuthContext>;
}
