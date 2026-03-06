import axios, { endpoints } from 'src/lib/axios';

import { setSession } from './utils';
import { JWT_STORAGE_KEY, JWT_REFRESH_KEY, JWT_REMEMBER_KEY } from './constant';

// ----------------------------------------------------------------------

/** **************************************
 * Sign in
 *************************************** */
export const signInWithPassword = async ({ email, password, rememberMe = false }) => {
  try {
    // FastAPI OAuth2 requiere form-data con campo "username"
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const res = await axios.post(endpoints.auth.signIn, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token, refresh_token } = res.data;

    if (!access_token) {
      throw new Error('Access token not found in response');
    }

    // Guardar preferencia de "recordarme" antes de setSession (que la necesita para storeRefreshToken)
    if (rememberMe) {
      localStorage.setItem(JWT_REMEMBER_KEY, 'true');
    } else {
      localStorage.removeItem(JWT_REMEMBER_KEY);
    }

    await setSession(access_token);

    if (refresh_token) {
      if (rememberMe) {
        localStorage.setItem(JWT_REFRESH_KEY, refresh_token);
      } else {
        sessionStorage.setItem(JWT_REFRESH_KEY, refresh_token);
      }
    }
  } catch (error) {
    console.error('Error during sign in:', error);
    throw error;
  }
};

/** **************************************
 * Sign up
 *************************************** */
export const signUp = async ({ email, password, firstName, lastName }) => {
  const params = {
    email,
    password,
    firstName,
    lastName,
  };

  try {
    const res = await axios.post(endpoints.auth.signUp, params);

    const { accessToken } = res.data;

    if (!accessToken) {
      throw new Error('Access token not found in response');
    }

    sessionStorage.setItem(JWT_STORAGE_KEY, accessToken);
  } catch (error) {
    console.error('Error during sign up:', error);
    throw error;
  }
};

/** **************************************
 * Sign out
 *************************************** */
export const signOut = async () => {
  try {
    await axios.post(endpoints.auth.signOut).catch(() => {
      // Si el servidor falla, continuamos con el logout local
    });
    await setSession(null); // setSession(null) ya limpia ambos storages
    localStorage.removeItem(JWT_REMEMBER_KEY);
  } catch (error) {
    console.error('Error during sign out:', error);
    throw error;
  }
};
