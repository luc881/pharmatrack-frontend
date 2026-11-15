import { test as base, expect } from '@playwright/test';

import { E2E } from '../playwright.config';

// ----------------------------------------------------------------------
// Lo común a todos los recorridos:
// - `api`: cliente del API con sesión, para preparar datos sin pasar por la UI
// - `page`: ya con sesión iniciada, y que falla la prueba si la página lanza
//   un error (los que en producción solo verías en la consola)
// - `seed`: atajos para crear especies, variedades, animales y productos
// ----------------------------------------------------------------------

let cachedToken = null;

async function login(request) {
  if (cachedToken) return cachedToken;
  const res = await request.post(`${E2E.api}/api/v1/auth/token`, {
    form: { username: E2E.email, password: E2E.password },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  cachedToken = (await res.json()).access_token;
  return cachedToken;
}

// Nombres únicos por corrida: los recorridos no chocan entre sí
let counter = 0;
export const unique = (prefix) => `${prefix} ${Date.now().toString(36)}${(counter += 1)}`;

function apiClient(request, token) {
  const call = async (method, url, data) => {
    const res = await request.fetch(`${E2E.api}/api/v1${url}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      ...(data !== undefined ? { data } : {}),
    });
    const body = await res.text();
    if (!res.ok()) throw new Error(`${method} ${url} → ${res.status()}: ${body}`);
    return body ? JSON.parse(body) : null;
  };
  return {
    get: (url) => call('GET', url),
    post: (url, data) => call('POST', url, data),
    put: (url, data) => call('PUT', url, data),
    patch: (url, data) => call('PATCH', url, data),
    del: (url) => call('DELETE', url),
    // el catálogo público no lleva sesión
    publicGet: async (url) => (await request.get(`${E2E.api}/api/v1${url}`)).json(),
  };
}

function seeder(api) {
  return {
    // grupo → género → especie (y sus variedades)
    async species({
      group = unique('Grupo'),
      genus = unique('Genus'),
      name = unique('sp'),
      common,
      morphs = [],
      ...extra
    } = {}) {
      const g = await api.post('/animal-groups', { name: group });
      const ge = await api.post('/genera', { name: genus, group_id: g.id });
      const sp = await api.post('/species', {
        genus_id: ge.id,
        name,
        ...(common ? { common_name: common } : {}),
        ...extra,
      });
      const created = [];
      for (const m of morphs) {
        created.push(await api.post('/morphs', { species_id: sp.id, name: m }));
      }
      return { group: g, genus: ge, species: sp, morphs: created };
    },
    animal: (speciesId, { morphIds = [], price = 500, ...extra } = {}) =>
      api.post('/animals', {
        species_id: speciesId,
        sex: 'unknown',
        price,
        price_cost: 0,
        morph_ids: morphIds,
        ...extra,
      }),
    async product({ title = unique('Producto'), price = 100, stock = null, ...extra } = {}) {
      const categories = await api.get('/productscategories?page_size=1');
      const category =
        categories.data?.[0] ??
        (await api.post('/productscategories', { name: unique('Categoría') }));
      const p = await api.post('/products', {
        title,
        price_retail: price,
        price_cost: 0,
        product_category_id: category.id,
        unit_name: 'pieza',
        tracks_batches: stock !== null,
        ...extra,
      });
      if (stock !== null) {
        await api.post('/productsbatches', {
          product_id: p.id,
          quantity: stock,
          purchase_price: 0,
        });
      }
      return p;
    },
  };
}

export const test = base.extend({
  api: async ({ request }, use) => {
    await use(apiClient(request, await login(request)));
  },
  seed: async ({ api }, use) => {
    await use(seeder(api));
  },
  page: async ({ page, request }, use) => {
    const token = await login(request);
    // la sesión vive en sessionStorage: se pone antes de que cargue la app
    await page.addInitScript((t) => {
      window.sessionStorage.setItem('jwt_access_token', t);
      // imprimir abre un diálogo del sistema: en las pruebas no hace nada
      window.print = () => {
        window.__printed = (window.__printed ?? 0) + 1;
      };
    }, token);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await use(page);
    expect(errors, 'La página lanzó errores de JavaScript').toEqual([]);
  },
});

export { expect };
