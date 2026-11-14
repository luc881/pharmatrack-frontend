import { useSetState } from 'minimal-shared/hooks';
import { useRef, useMemo, useEffect, useCallback } from 'react';

import axios, { endpoints } from 'src/lib/axios';

import { AuthContext } from '../auth-context';
import { savedOfflineUser } from './offline-user';
import { jwtDecode, setSession, isValidToken } from './utils';
import { JWT_STORAGE_KEY, JWT_REFRESH_KEY, JWT_REMEMBER_KEY } from './constant';

// ----------------------------------------------------------------------

/**
 * NOTE:
 * We only build demo at basic level.
 * Customer will need to do some extra handling yourself if you want to extend the logic and other features...
 */

// Usuario que la venta rápida guardó en el equipo al «Preparar». Sin red no
// se puede validar ni renovar el token; con él la pantalla sigue abierta y
// trabaja solo con datos locales (subir ventas sí exige sesión válida).
async function offlineUser() {
  const user = await savedOfflineUser();
  return user ? { ...user, offline: true } : null;
}

// Fetch live permissions from /me. Falls back to JWT-embedded permissions on error.
async function fetchLivePermissions(jwtPermissions) {
  try {
    const res = await axios.get(endpoints.user.me);
    return res.data?.role?.permissions?.map((p) => p.name) ?? jwtPermissions;
  } catch {
    return jwtPermissions;
  }
}

export function AuthProvider({ children }) {
  const { state, setState } = useSetState({ user: null, loading: true });
  const stateRef = useRef(state);
  stateRef.current = state;

  const checkUserSession = useCallback(async () => {
    try {
      const accessToken = sessionStorage.getItem(JWT_STORAGE_KEY);

      if (accessToken && isValidToken(accessToken)) {
        await setSession(accessToken);

        const decoded = jwtDecode(accessToken);
        const permissions = await fetchLivePermissions(decoded.permissions ?? []);
        const user = {
          id: decoded.id,
          email: decoded.sub,
          role: decoded.role,
          permissions,
          displayName: decoded.sub,
        };
        setState({ user: { ...user, accessToken }, loading: false });
        return;
      }

      // Sin access token válido: intentar renovar con refresh token (remember me)
      const refreshToken =
        sessionStorage.getItem(JWT_REFRESH_KEY) || localStorage.getItem(JWT_REFRESH_KEY);

      if (refreshToken) {
        let res;
        try {
          res = await axios.post(endpoints.auth.refresh, { refresh_token: refreshToken });
        } catch (error) {
          // Sin red (sin status) se entra con el usuario del equipo; un rechazo
          // del servidor solo conserva a quien ya estaba trabajando sin red
          const fallback =
            error?.status === undefined || stateRef.current.user?.offline
              ? await offlineUser()
              : null;
          setState({ user: fallback, loading: false });
          return;
        }
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
        const permissions = await fetchLivePermissions(decoded.permissions ?? []);
        const user = {
          id: decoded.id,
          email: decoded.sub,
          role: decoded.role,
          permissions,
          displayName: decoded.sub,
        };
        setState({ user: { ...user, accessToken: access_token }, loading: false });
        return;
      }

      // Sin ninguna sesión: solo sin red se abre con el usuario del equipo
      const fallback =
        !navigator.onLine || stateRef.current.user?.offline ? await offlineUser() : null;
      setState({ user: fallback, loading: false });
    } catch (error) {
      console.error(error);
      setState({ user: null, loading: false });
    }
  }, [setState]);

  useEffect(() => {
    checkUserSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al volver la red, quien entró sin ella intenta recuperar su sesión real
  const isOffline = Boolean(state.user?.offline);
  useEffect(() => {
    if (!isOffline) return undefined;
    window.addEventListener('online', checkUserSession);
    return () => window.removeEventListener('online', checkUserSession);
  }, [isOffline, checkUserSession]);

  // ----------------------------------------------------------------------

  const checkAuthenticated = state.user ? 'authenticated' : 'unauthenticated';

  const status = state.loading ? 'loading' : checkAuthenticated;

  const memoizedValue = useMemo(
    () => ({
      user: state.user
        ? {
            ...state.user,
            role: state.user?.role ?? '',
            permissions: state.user?.permissions ?? [],
          }
        : null,
      checkUserSession,
      loading: status === 'loading',
      authenticated: status === 'authenticated',
      unauthenticated: status === 'unauthenticated',
    }),
    [checkUserSession, state.user, status]
  );

  return <AuthContext value={memoizedValue}>{children}</AuthContext>;
}
