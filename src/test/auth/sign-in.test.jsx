import { http, HttpResponse } from 'msw';
import { describe, it, expect } from 'vitest';

import { signInWithPassword } from 'src/auth/context/jwt/action';

import { server } from '../mocks/server';

// ----------------------------------------------------------------------
// Tests del flujo de autenticación
// ----------------------------------------------------------------------

describe('signInWithPassword', () => {
  it('guarda el access_token en sessionStorage cuando el login es exitoso', async () => {
    await signInWithPassword({
      email: 'admin@farmaciaselene.com',
      password: '123456',
    });

    // El token debe quedar almacenado
    const stored =
      sessionStorage.getItem('jwt_access_token') ||
      localStorage.getItem('jwt_access_token');
    expect(stored).toBeTruthy();
  });

  it('lanza un error cuando las credenciales son incorrectas', async () => {
    // Sobreescribimos el handler para simular credenciales inválidas
    server.use(
      http.post('https://api.farmaciaselene.com/api/v1/auth/token', () =>
        HttpResponse.json({ detail: 'Credenciales incorrectas' }, { status: 401 })
      )
    );

    await expect(
      signInWithPassword({ email: 'malo@mail.com', password: 'wrong' })
    ).rejects.toThrow();
  });

  it('guarda el refresh_token en localStorage cuando rememberMe es true', async () => {
    await signInWithPassword({
      email: 'admin@farmaciaselene.com',
      password: '123456',
      rememberMe: true,
    });

    expect(localStorage.getItem('jwt_refresh_token')).toBeTruthy();
  });
});
