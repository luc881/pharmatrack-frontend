import { IDBFactory } from 'fake-indexeddb';
import { http, delay, HttpResponse } from 'msw';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { getKV, setKV, putSale, listSales } from 'src/sections/quick-sale/quick-sale-store';
import {
  retrySale,
  syncQueue,
  backupData,
  discardSale,
  enqueueSale,
  prepareOffline,
  resolvePriceChange,
} from 'src/sections/quick-sale/quick-sale-sync';

import { setSession } from 'src/auth/context/jwt/utils';

import { server } from '../mocks/server';

const API = 'https://api.opuntiaden.com/api/v1';

const cueva = {
  id: 1,
  title: 'Cueva de resina',
  image: 'https://res.cloudinary.com/demo/image/upload/cueva.jpg',
  price_retail: '80.00',
  tax_percentage: null,
  max_discount: null,
  stock: 8,
  is_bundle: false,
  components: [],
  animal: null,
};
const byId = new Map([[1, cueva]]);
const user = { id: 3, email: 'a@b.mx', role: 'admin', permissions: ['sales.create'] };

const enqueue = (key, quantity = 1) =>
  enqueueSale({
    key,
    cart: [{ product_id: 1, quantity, discount: 0 }],
    itemsById: byId,
    method: 'cash',
    branchId: 7,
  });

// Servidor de mentira con la misma idempotencia que el real
function fakeCheckout({ fail = () => null } = {}) {
  const sales = new Map();
  const bodies = [];
  server.use(
    http.post(`${API}/sales/checkout`, async ({ request }) => {
      const body = await request.json();
      bodies.push(body);
      const failure = await fail(body, bodies.length);
      if (failure) return failure;
      if (!sales.has(body.idempotency_key)) {
        sales.set(body.idempotency_key, {
          id: 500 + sales.size,
          total: Number(body.payments[0].amount).toFixed(2),
        });
      }
      return HttpResponse.json(sales.get(body.idempotency_key), { status: 201 });
    })
  );
  return { sales, bodies };
}

const statuses = async () => (await listSales()).map((s) => s.status);

describe('venta rápida: preparar el dispositivo', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    server.use(
      http.get(`${API}/products/quick-sale`, () => HttpResponse.json([cueva])),
      http.get(`${API}/settings/email-ticket`, () => HttpResponse.json({ business_name: 'Otro' })),
      http.get(`${API}/settings/ticket-print`, () => HttpResponse.json({ width: 58, offset: -1 })),
      http.get('https://res.cloudinary.com/*', () => HttpResponse.error())
    );
  });

  it('guarda catálogo y contexto; una foto que falla no lo detiene', async () => {
    const result = await prepareOffline({ branchId: 7, user });

    expect(result.count).toBe(1);
    expect((await getKV('catalog')).items).toEqual([cueva]);
    expect(await getKV('context')).toMatchObject({
      business: { business_name: 'Otro' },
      ticketSettings: { width: 58, offset: -1 },
      branchId: 7,
      user,
    });
  });

  it('guarda las fotos en su propio caché, aparte del resto del dashboard', async () => {
    const stored = [];
    globalThis.caches = {
      open: async (name) => ({ put: async (url) => stored.push([name, url]) }),
    };
    server.use(http.get('https://res.cloudinary.com/*', () => new HttpResponse('foto')));
    try {
      await prepareOffline({ branchId: 7, user });
    } finally {
      delete globalThis.caches;
    }
    expect(stored).toEqual([['quick-sale-images', cueva.image]]);
  });

  it('si el catálogo no baja, lo guardado queda intacto', async () => {
    await setKV('catalog', { items: [{ id: 99 }], fetchedAt: 'antes' });
    server.use(
      http.get(`${API}/products/quick-sale`, () => new HttpResponse(null, { status: 500 }))
    );

    await expect(prepareOffline({ branchId: 7, user })).rejects.toThrow();
    expect(await getKV('catalog')).toEqual({ items: [{ id: 99 }], fetchedAt: 'antes' });
  });

  it('sin datos del negocio o ajuste de impresora igual se prepara', async () => {
    server.use(
      http.get(`${API}/settings/email-ticket`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${API}/settings/ticket-print`, () => new HttpResponse(null, { status: 500 }))
    );
    await prepareOffline({ branchId: 7, user });
    expect((await getKV('context')).business).toEqual({});
  });

  it('limpia las ventas subidas de hace más de una semana', async () => {
    const old = new Date(Date.now() - 8 * 86400000).toISOString();
    await putSale({ idempotency_key: 'vieja-subida', sold_at: old, status: 'synced', lines: [] });
    await putSale({
      idempotency_key: 'vieja-pendiente',
      sold_at: old,
      status: 'pending',
      lines: [],
    });

    await prepareOffline({ branchId: 7, user });
    expect((await listSales()).map((s) => s.idempotency_key)).toEqual(['vieja-pendiente']);
  });
});

describe('venta rápida: preparar no pierde lo que ya sabía', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    server.use(
      http.get(`${API}/products/quick-sale`, () => HttpResponse.json([cueva])),
      http.get(`${API}/settings/email-ticket`, () => HttpResponse.json({})),
      http.get(`${API}/settings/ticket-print`, () => HttpResponse.json({ width: 58, offset: 0 })),
      http.get('https://res.cloudinary.com/*', () => HttpResponse.error())
    );
  });

  it('si aún no se sabe la sucursal conserva la guardada', async () => {
    await prepareOffline({ branchId: 7, user });
    // al abrir, la lista de sucursales todavía no llega
    await prepareOffline({ branchId: null, user });
    expect((await getKV('context')).branchId).toBe(7);
  });

  it('anota cuándo pidió el catálogo y no pisa uno más nuevo', async () => {
    const before = new Date().toISOString();
    await prepareOffline({ branchId: 7, user });
    const saved = await getKV('catalog');
    expect(saved.requestedAt >= before).toBe(true);

    // otra preparación más vieja termina después: no debe ganar
    await setKV('catalog', {
      ...saved,
      items: [{ id: 99 }],
      requestedAt: '2999-01-01T00:00:00.000Z',
    });
    await prepareOffline({ branchId: 7, user });
    expect((await getKV('catalog')).items).toEqual([{ id: 99 }]);
  });
});

describe('venta rápida: cola y subida', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('encolar da folio, hora y deja la venta pendiente', async () => {
    const sale = await enqueue('llave-0001', 2);
    expect(sale.folio).toMatch(/^VR-[A-Z0-9]{4}-0001$/);
    expect(new Date(sale.sold_at).getTime()).toBeLessThanOrEqual(Date.now());
    expect(sale.totals.total).toBe(160);
    expect(await statuses()).toEqual(['pending']);
  });

  it('la misma llave dos veces deja una sola venta', async () => {
    const [a, b] = await Promise.all([enqueue('llave-0001'), enqueue('llave-0001')]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(await listSales()).toHaveLength(1);
  });

  it('sube la venta con su folio, llave y hora', async () => {
    const { bodies } = fakeCheckout();
    const sale = await enqueue('llave-0001', 2);

    expect(await syncQueue()).toMatchObject({ synced: 1, review: 0, pending: 0 });
    expect(bodies[0]).toEqual({
      branch_id: 7,
      description: `Venta rápida · ${sale.folio}`,
      items: [{ product_id: 1, quantity: 2, discount: 0 }],
      payments: [{ method_payment: 'cash', amount: 160 }],
      idempotency_key: 'llave-0001',
      sold_at: sale.sold_at,
    });
    const [saved] = await listSales();
    expect(saved).toMatchObject({ status: 'synced', sale_id: 500 });
  });

  it('respuesta perdida: al reintentar no se duplica', async () => {
    // el servidor sí registra la venta, pero la respuesta no llega
    const { sales } = fakeCheckout({
      fail: (body, n) => {
        if (n !== 1) return null;
        sales.set(body.idempotency_key, { id: 500, total: '80.00' });
        return HttpResponse.error();
      },
    });
    await enqueue('llave-0001');

    expect(await syncQueue()).toMatchObject({ synced: 0, pending: 1 });
    expect(await syncQueue()).toMatchObject({ synced: 1, pending: 0 });
    expect(sales.size).toBe(1);
    expect((await listSales())[0]).toMatchObject({ status: 'synced', sale_id: 500 });
  });

  it('dos subidas a la vez mandan cada venta una sola vez', async () => {
    const { bodies } = fakeCheckout();
    await enqueue('llave-0001');
    await enqueue('llave-0002');

    await Promise.all([syncQueue(), syncQueue()]);
    expect(bodies.map((b) => b.idempotency_key).sort()).toEqual(['llave-0001', 'llave-0002']);
  });

  it('si el servidor registra otro total, queda por revisar y no se reenvía', async () => {
    const { bodies } = fakeCheckout();
    server.use(
      http.post(`${API}/sales/checkout`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ id: 900, total: '95.00' }, { status: 201 });
      })
    );
    await enqueue('llave-0001');

    expect(await syncQueue()).toMatchObject({ synced: 0, review: 1 });
    const [saved] = await listSales();
    expect(saved).toMatchObject({ status: 'review', sale_id: 900, server_total: 95 });
    expect(saved.reason).toMatch(/\$80.*\$95/);

    // «Reintentar» sobre una venta que el servidor ya tiene solo la da por buena
    await retrySale('llave-0001');
    expect((await listSales())[0].status).toBe('synced');
    expect(bodies).toHaveLength(1);
  });

  it('un rechazo del servidor queda por revisar con su motivo y sigue con las demás', async () => {
    fakeCheckout({
      fail: (body) =>
        body.idempotency_key === 'llave-0001'
          ? HttpResponse.json(
              { detail: 'Stock insuficiente para Cueva de resina' },
              { status: 400 }
            )
          : null,
    });
    await enqueue('llave-0001');
    await enqueue('llave-0002');

    expect(await syncQueue()).toMatchObject({ synced: 1, review: 1, pending: 0 });
    const [first] = await listSales();
    expect(first).toMatchObject({
      status: 'review',
      reason: 'Stock insuficiente para Cueva de resina',
    });
    expect(first.sale_id).toBeUndefined();
  });

  it('reintentar una venta rechazada la vuelve a mandar', async () => {
    let reject = true;
    const { bodies } = fakeCheckout({
      fail: () =>
        reject ? HttpResponse.json({ detail: 'Stock insuficiente' }, { status: 400 }) : null,
    });
    await enqueue('llave-0001');
    await syncQueue();

    reject = false; // el dueño corrigió el stock en el dashboard
    await retrySale('llave-0001');
    expect((await listSales())[0].status).toBe('synced');
    expect(bodies).toHaveLength(2);
  });

  it('sin sesión las ventas siguen pendientes y avisa que hay que entrar', async () => {
    fakeCheckout({ fail: () => new HttpResponse(null, { status: 401 }) });
    await enqueue('llave-0001');
    await enqueue('llave-0002');

    expect(await syncQueue()).toMatchObject({ synced: 0, pending: 2, needsLogin: true });
    expect(await statuses()).toEqual(['pending', 'pending']);
  });

  it('sin red se detiene y deja todo pendiente', async () => {
    const { bodies } = fakeCheckout({ fail: () => HttpResponse.error() });
    await enqueue('llave-0001');
    await enqueue('llave-0002');

    expect(await syncQueue()).toMatchObject({ synced: 0, pending: 2, needsLogin: false });
    expect(bodies).toHaveLength(1);
  });

  it('un error del servidor en una venta no detiene las que siguen', async () => {
    fakeCheckout({
      fail: (body) =>
        body.idempotency_key === 'llave-0001' ? new HttpResponse(null, { status: 500 }) : null,
    });
    await enqueue('llave-0001');
    await enqueue('llave-0002');

    expect(await syncQueue()).toMatchObject({ synced: 1, pending: 1, needsLogin: false });
    expect(await statuses()).toEqual(['pending', 'synced']);
  });

  it('una venta de $0 (descuento del 100 %) sube sin pago', async () => {
    const { bodies } = fakeCheckout({
      fail: () => HttpResponse.json({ id: 600, total: '0.00' }, { status: 201 }),
    });
    await enqueueSale({
      key: 'llave-0001',
      cart: [{ product_id: 1, quantity: 1, discount: 80 }],
      itemsById: byId,
      method: 'cash',
      branchId: 7,
    });

    expect(await syncQueue()).toMatchObject({ synced: 1, review: 0 });
    expect(bodies[0].payments).toEqual([]);
  });

  it('reintentar mientras otra subida corre no deja la venta para después', async () => {
    let reject = true;
    let hold = false;
    let release;
    let arrived;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const uploading = new Promise((resolve) => {
      arrived = resolve;
    });
    fakeCheckout({
      fail: async (body) => {
        if (hold && body.idempotency_key === 'llave-0002') {
          arrived();
          await gate;
        }
        return reject && body.idempotency_key === 'llave-0001'
          ? HttpResponse.json({ detail: 'Stock insuficiente' }, { status: 400 })
          : null;
      },
    });
    await enqueue('llave-0001');
    await syncQueue(); // la 0001 queda por revisar
    reject = false;

    await enqueue('llave-0002');
    hold = true;
    const slow = syncQueue(); // se queda subiendo la 0002
    await uploading;
    const retry = retrySale('llave-0001');
    // ya volvió a la cola, con la otra subida todavía en curso
    await vi.waitFor(async () => expect((await listSales())[0].status).toBe('pending'));
    release();
    await Promise.all([slow, retry]);
    expect(await statuses()).toEqual(['synced', 'synced']);
  });

  it('descartar borra del equipo una venta rechazada, no una que falta subir', async () => {
    fakeCheckout({
      fail: (body) =>
        body.idempotency_key === 'llave-0001'
          ? HttpResponse.json({ detail: 'Stock insuficiente' }, { status: 400 })
          : HttpResponse.error(),
    });
    await enqueue('llave-0001');
    await enqueue('llave-0002');
    await syncQueue();

    await discardSale('llave-0001');
    await discardSale('llave-0002');
    expect((await listSales()).map((s) => s.idempotency_key)).toEqual(['llave-0002']);
  });

  it('el respaldo trae lo que falta por subir', async () => {
    fakeCheckout();
    await enqueue('llave-0001');
    await syncQueue();
    await enqueue('llave-0002');

    const backup = await backupData();
    expect(backup.sales.map((s) => s.idempotency_key)).toEqual(['llave-0002']);
    expect(backup.exported_at).toBeTruthy();
  });
  it('al subir anota cuándo, para saber si el catálogo ya la trae restada', async () => {
    fakeCheckout();
    await enqueue('llave-0001');
    await syncQueue();
    expect(new Date((await listSales())[0].synced_at).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('con el token caducado renueva la sesión y sube sin pedir entrar', async () => {
    const payload = btoa(JSON.stringify({ id: 3, sub: 'a@b.mx', exp: Date.now() / 1000 + 3600 }));
    localStorage.setItem('jwt_refresh_token', 'r1');
    let refreshed = false;
    server.use(
      http.post(`${API}/auth/refresh`, () => {
        refreshed = true;
        return HttpResponse.json({ access_token: `x.${payload}.x`, refresh_token: 'r2' });
      })
    );
    fakeCheckout({ fail: () => (refreshed ? null : new HttpResponse(null, { status: 401 })) });
    await enqueue('llave-0001');

    expect(await syncQueue()).toMatchObject({ synced: 1, pending: 0, needsLogin: false });
    await setSession(null);
    localStorage.clear();
  });

  it('una conexión que se queda colgada no congela las siguientes subidas', async () => {
    let hang = true;
    server.use(
      http.post(`${API}/sales/checkout`, async () => {
        if (hang) await delay('infinite');
        return HttpResponse.json({ id: 700, total: '80.00' }, { status: 201 });
      })
    );
    await enqueue('llave-0001');

    expect(await syncQueue({ timeout: 150 })).toMatchObject({ synced: 0, pending: 1 });
    hang = false;
    expect(await syncQueue({ timeout: 150 })).toMatchObject({ synced: 1, pending: 0 });
  });
});

describe('venta rápida: precios cambiados al cobrar', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('un animal a otro precio queda por revisar; guardarlo cambia su ficha', async () => {
    const puts = [];
    server.use(
      http.put(`${API}/animals/:id`, async ({ request, params }) => {
        puts.push([Number(params.id), await request.json()]);
        return HttpResponse.json({ id: Number(params.id) });
      })
    );
    const isopod = {
      ...cueva,
      id: 4,
      title: 'Orange Freezy',
      price_retail: '1.00',
      animal: { id: 9 },
    };
    const sale = await enqueueSale({
      key: 'k-precio-1',
      cart: [{ product_id: 4, quantity: 2, discount: 0, unit_price: 150 }],
      itemsById: new Map([[4, isopod]]),
      method: 'cash',
      branchId: 7,
    });
    expect(sale.totals.total).toBe(300);
    expect(sale.lines[0]).toMatchObject({ unit_price: 150, price_retail: 150 });
    expect(await getKV('priceReview')).toEqual([
      { product_id: 4, animal_id: 9, title: 'Orange Freezy', catalog_price: 1, prices: [150] },
    ]);

    await resolvePriceChange(4, 150);
    expect(puts).toEqual([[9, { price: 150 }]]);
    expect(await getKV('priceReview')).toEqual([]);
  });
});
