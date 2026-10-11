import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

// ----------------------------------------------------------------------

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: /^src(.+)/, replacement: path.resolve(process.cwd(), 'src/$1') }],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    // Las pruebas de formularios MUI completos pasan de 5 s con toda la suite en paralelo
    testTimeout: 15000,
    env: {
      VITE_SERVER_URL: 'https://api.opuntiaden.com',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{js,jsx}'],
    },
  },
});
