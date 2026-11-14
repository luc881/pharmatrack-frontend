import fs from 'fs';
import path from 'path';
import checker from 'vite-plugin-checker';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import react from '@vitejs/plugin-react-swc';

// ----------------------------------------------------------------------

const PORT = 3030;

// Defaults del %VITE_…% de index.html (los mismos que global-config.js); cada
// instalación los pisa con sus variables de entorno
process.env.VITE_APP_NAME ||= 'Opuntia Den';
process.env.VITE_BRAND_DIR ||= '/brand/assets';

// Las carpetas de marca de otras instalaciones no se guardan en este equipo
const otherBrands = fs
  .readdirSync('public/brand', { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(`public/brand/${d.name}/favicon`))
  .filter((d) => `/brand/${d.name}` !== process.env.VITE_BRAND_DIR)
  .map((d) => `brand/${d.name}/**`);

export default defineConfig({
  plugins: [
    react(),
    checker({
      eslint: {
        useFlatConfig: true,
        lintCommand: 'eslint "./src/**/*.{js,jsx,ts,tsx}"',
        dev: { logLevel: ['error'] },
      },
      overlay: {
        position: 'tl',
        initialIsOpen: false,
      },
    }),
    // Service worker: la app abre sin internet (venta rápida en convenciones).
    // Solo existe en el build; para probarlo: yarn build && yarn preview.
    VitePWA({
      // El manifest lo pone cada marca (<link rel="manifest"> en index.html)
      manifest: false,
      // 'prompt': una versión nueva espera a que se cierre la app o a que el
      // usuario toque «Actualizar» en el aviso (main.jsx). Nunca recarga la
      // página sola a media venta.
      registerType: 'prompt',
      workbox: {
        // Toma el control en la primera visita, para que «Preparar» ya
        // guarde las fotos sin tener que recargar
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,jpg,webp,woff2,webmanifest}'],
        globIgnores: ['**/node_modules/**/*', ...otherBrands],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Las llamadas al API no se guardan aquí: el catálogo y las ventas
        // viven en IndexedDB (sections/quick-sale/quick-sale-store.js)
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/res\.cloudinary\.com\//,
            handler: 'CacheFirst',
            options: {
              // Solo lee: las fotos las guarda «Preparar» (prepareOffline en
              // quick-sale-sync.js). El resto del dashboard no llena el caché.
              cacheName: 'quick-sale-images',
              plugins: [{ cacheWillUpdate: async () => null }],
              // Cloudinary responde con «Vary: Accept» y <img> pide otro Accept
              matchOptions: { ignoreVary: true },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: [
      {
        find: /^src(.+)/,
        replacement: path.resolve(process.cwd(), 'src/$1'),
      },
    ],
  },
  server: { port: PORT, host: true },
  preview: { port: PORT, host: true },
});
