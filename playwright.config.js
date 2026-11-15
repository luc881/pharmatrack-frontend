import path from 'path';
import { defineConfig, devices } from '@playwright/test';

// ----------------------------------------------------------------------
// Pruebas de punta a punta: un navegador real contra el dashboard compilado
// (con su service worker, como en producción) y el API real con una base de
// datos propia que se borra y se vuelve a crear en cada corrida.
//
//   yarn e2e            corre todo (levanta API y dashboard solo)
//   yarn e2e --ui       modo visual para ver y repetir cada paso
//
// Requisitos locales: Postgres en localhost:5432 (postgres/postgres) y el
// repo del API junto a este (../pharmatrack-api) con `poetry install`.
// ----------------------------------------------------------------------

export const E2E = {
  api: 'http://localhost:8010',
  app: 'http://localhost:3040',
  // usuario solo de esta base de pruebas (se crea al arrancar el API)
  email: process.env.E2E_EMAIL ?? 'e2e-pruebas@opuntiaden.com',
  password: process.env.E2E_PASSWORD ?? 'e2e-solo-pruebas-locales',
};

const API_DIR = process.env.E2E_API_DIR ?? path.resolve('..', 'pharmatrack-api');
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/pharmatrack_e2e';

export default defineConfig({
  testDir: './e2e',
  // los recorridos comparten la base: uno a la vez, en orden
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: E2E.app,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // base limpia → migraciones → API (siembra permisos, roles, sucursal y el usuario)
      command:
        'poetry run python scripts/e2e_reset_db.py && poetry run alembic upgrade head && poetry run uvicorn pharmatrack.main:app --port 8010',
      cwd: API_DIR,
      url: `${E2E.api}/healthcheck`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        DATABASE_URL,
        SECRET_KEY: 'e2e-secret-key-not-for-production',
        ENVIRONMENT: 'development',
        SEED_CATALOG: 'false',
        SUPERUSER_EMAIL: E2E.email,
        SUPERUSER_PASSWORD: E2E.password,
        LOG_LEVEL: 'WARNING',
        // las semillas imprimen emojis: la consola de Windows no los aguanta sin esto
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    },
    {
      // el build real (no `yarn dev`): así corre también el service worker
      command:
        'corepack yarn vite build --outDir dist-e2e && corepack yarn vite preview --outDir dist-e2e --port 3040 --strictPort',
      url: E2E.app,
      timeout: 300_000,
      reuseExistingServer: false,
      env: { VITE_SERVER_URL: E2E.api },
    },
  ],
});
