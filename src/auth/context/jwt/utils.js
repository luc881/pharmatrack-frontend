import { paths } from 'src/routes/paths';

import axios, { endpoints } from 'src/lib/axios';

import { JWT_STORAGE_KEY, JWT_REFRESH_KEY, JWT_REMEMBER_KEY } from './constant';

// ----------------------------------------------------------------------

export function jwtDecode(token) {
  try {
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length < 2) {
      throw new Error('Invalid token!');
    }

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(base64));

    return decoded;
  } catch (error) {
    console.error('Error decoding token:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export function isValidToken(accessToken) {
  if (!accessToken) {
    return false;
  }

  try {
    const decoded = jwtDecode(accessToken);

    if (!decoded || !('exp' in decoded)) {
      return false;
    }

    const currentTime = Date.now() / 1000;

    return decoded.exp > currentTime;
  } catch (error) {
    console.error('Error during token validation:', error);
    return false;
  }
}

// ----------------------------------------------------------------------

let refreshTimer = null;

function getStoredRefreshToken() {
  return sessionStorage.getItem(JWT_REFRESH_KEY) || localStorage.getItem(JWT_REFRESH_KEY);
}

function storeRefreshToken(token) {
  const rememberMe = localStorage.getItem(JWT_REMEMBER_KEY) === 'true';
  if (rememberMe) {
    localStorage.setItem(JWT_REFRESH_KEY, token);
  } else {
    sessionStorage.setItem(JWT_REFRESH_KEY, token);
  }
}

async function doRefresh() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');

  const res = await axios.post(endpoints.auth.refresh, { refresh_token: refreshToken });
  return res.data;
}

// Renovación que quedó esperando a que vuelva la red
let retryWhenOnline = null;

function cancelPendingRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  if (retryWhenOnline) {
    window.removeEventListener('online', retryWhenOnline);
    retryWhenOnline = null;
  }
}

async function refreshNow() {
  try {
    const { access_token, refresh_token } = await doRefresh();
    if (refresh_token) storeRefreshToken(refresh_token);
    await setSession(access_token);
  } catch (error) {
    // Sin red (el error de axios no trae status) no se cierra la sesión: en
    // una convención sin internet la venta rápida sigue con los datos del
    // equipo. Se reintenta al volver la conexión.
    if (getStoredRefreshToken() && error?.status === undefined) {
      retryWhenOnline = () => {
        retryWhenOnline = null;
        refreshNow();
      };
      window.addEventListener('online', retryWhenOnline, { once: true });
      return;
    }
    await setSession(null);
    window.location.href = paths.auth.jwt.signIn;
  }
}

function scheduleTokenRefresh(exp) {
  cancelPendingRefresh();

  // Renovar 60 segundos antes de que expire
  const delay = Math.max(exp * 1000 - Date.now() - 60_000, 0);

  refreshTimer = setTimeout(refreshNow, delay);
}

// ----------------------------------------------------------------------

export async function setSession(accessToken) {
  cancelPendingRefresh();

  try {
    if (accessToken) {
      sessionStorage.setItem(JWT_STORAGE_KEY, accessToken);
      axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

      const decoded = jwtDecode(accessToken);
      if (decoded?.exp) {
        scheduleTokenRefresh(decoded.exp);
      } else {
        throw new Error('Invalid access token!');
      }
    } else {
      sessionStorage.removeItem(JWT_STORAGE_KEY);
      sessionStorage.removeItem(JWT_REFRESH_KEY);
      localStorage.removeItem(JWT_REFRESH_KEY);
      delete axios.defaults.headers.common.Authorization;
    }
  } catch (error) {
    console.error('Error during set session:', error);
    throw error;
  }
}
