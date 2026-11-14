import { http, HttpResponse } from 'msw';
import { IDBFactory } from 'fake-indexeddb';
import { render, screen, waitFor } from '@testing-library/react';
import { it, vi, expect, describe, afterEach, beforeEach } from 'vitest';

import { getKV, setKV } from 'src/sections/quick-sale/quick-sale-store';

import { useAuthContext } from 'src/auth/hooks';
import { signOut } from 'src/auth/context/jwt/action';
import { setSession } from 'src/auth/context/jwt/utils';
import { AuthProvider } from 'src/auth/context/jwt/auth-provider';

import { server } from '../mocks/server';

// ----------------------------------------------------------------------
// En una convención sin internet la sesión no puede cerrarse sola: el token
// caduca, pero la venta rápida trabaja con datos del equipo.
// ----------------------------------------------------------------------

const API = 'https://api.opuntiaden.com/api/v1';
const saved = { id: 3, email: 'a@b.mx', role: 'admin', permissions: ['sales.create'] };

const token = (expInSeconds) =>
  `x.${btoa(JSON.stringify({ id: 3, sub: 'a@b.mx', role: 'admin', permissions: [], exp: Date.now() / 1000 + expInSeconds }))}.x`;

const refresh = (response) => {
  const calls = { count: 0 };
  server.use(
    http.post(`${API}/auth/refresh`, () => {
      calls.count += 1;
      return response();
    })
  );
  return calls;
};

function Who() {
  const { user, loading, authenticated } = useAuthContext();
  if (loading) return <p>cargando</p>;
  return (
    <p>{authenticated ? `dentro:${user.email}:${user.offline ? 'offline' : 'online'}` : 'fuera'}</p>
  );
}

const start = () =>
  render(
    <AuthProvider>
      <Who />
    </AuthProvider>
  );

describe('sesión sin internet', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(async () => {
    await setSession(null); // cancela el temporizador de renovación
    vi.restoreAllMocks();
  });

  it('si la renovación falla por falta de red, no cierra la sesión', async () => {
    const calls = refresh(() => HttpResponse.error());
    localStorage.setItem('jwt_refresh_token', 'r1');
    const access = token(60.2); // se renueva 60 s antes de caducar: en ~200 ms
    await setSession(access);

    await waitFor(() => expect(calls.count).toBe(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem('jwt_access_token')).toBe(access);
    expect(localStorage.getItem('jwt_refresh_token')).toBe('r1');
  });

  it('al volver la red reintenta la renovación', async () => {
    let online = false;
    const calls = refresh(() =>
      online
        ? HttpResponse.json({ access_token: token(3600), refresh_token: 'r2' })
        : HttpResponse.error()
    );
    localStorage.setItem('jwt_remember_me', 'true');
    localStorage.setItem('jwt_refresh_token', 'r1');
    await setSession(token(60.2));
    await waitFor(() => expect(calls.count).toBe(1));

    online = true;
    window.dispatchEvent(new Event('online'));
    await waitFor(() => expect(localStorage.getItem('jwt_refresh_token')).toBe('r2'));
  });

  it('si el servidor rechaza la renovación, sí cierra la sesión', async () => {
    refresh(() => new HttpResponse(null, { status: 401 }));
    localStorage.setItem('jwt_refresh_token', 'r1');
    await setSession(token(60.2));

    await waitFor(() => expect(sessionStorage.getItem('jwt_access_token')).toBeNull());
  });

  it('abre con el usuario guardado en el equipo cuando no hay red', async () => {
    refresh(() => HttpResponse.error());
    localStorage.setItem('jwt_refresh_token', 'r1');
    await setKV('context', { user: saved });

    start();
    expect(await screen.findByText('dentro:a@b.mx:offline')).toBeInTheDocument();
  });

  it('sin red y sin token guardado también abre con el usuario del equipo', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await setKV('context', { user: saved });

    start();
    expect(await screen.findByText('dentro:a@b.mx:offline')).toBeInTheDocument();
  });

  it('sin red y sin usuario guardado queda fuera', async () => {
    refresh(() => HttpResponse.error());
    localStorage.setItem('jwt_refresh_token', 'r1');

    start();
    expect(await screen.findByText('fuera')).toBeInTheDocument();
  });

  it('con red, un rechazo del servidor no deja entrar con el usuario guardado', async () => {
    refresh(() => new HttpResponse(null, { status: 401 }));
    localStorage.setItem('jwt_refresh_token', 'r1');
    await setKV('context', { user: saved });

    start();
    expect(await screen.findByText('fuera')).toBeInTheDocument();
  });

  it('con red y sin sesión no entra aunque haya usuario guardado', async () => {
    server.use(http.get(`${API}/users/me`, () => new HttpResponse(null, { status: 401 })));
    await setKV('context', { user: saved });

    start();
    expect(await screen.findByText('fuera')).toBeInTheDocument();
  });

  it('cerrar sesión borra el usuario guardado en el equipo', async () => {
    server.use(http.post(`${API}/auth/logout`, () => HttpResponse.json({})));
    await setKV('context', { user: saved, branchId: 7 });

    await signOut();
    expect(await getKV('context')).toEqual({ user: null, branchId: 7 });
  });
  it('un error del servidor al renovar (502) no cierra la sesión', async () => {
    const calls = refresh(() => new HttpResponse(null, { status: 502 }));
    localStorage.setItem('jwt_refresh_token', 'r1');
    const access = token(60.2);
    await setSession(access);

    await waitFor(() => expect(calls.count).toBe(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem('jwt_access_token')).toBe(access);
    expect(localStorage.getItem('jwt_refresh_token')).toBe('r1');
  });

  it('con wifi pero sin internet (el API no responde) abre con el usuario del equipo', async () => {
    // navigator.onLine dice que sí hay red; lo que cuenta es si el API contesta
    server.use(http.get(`${API}/users/me`, () => HttpResponse.error()));
    await setKV('context', { user: saved });

    start();
    expect(await screen.findByText('dentro:a@b.mx:offline')).toBeInTheDocument();
  });
});
