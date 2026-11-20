import { SWRConfig } from 'swr';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { IDBFactory } from 'fake-indexeddb';
import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';
import { render, screen, within, waitFor, renderHook } from '@testing-library/react';

import { useQuickSale } from 'src/sections/quick-sale/use-quick-sale';
import { QuickSaleView } from 'src/sections/quick-sale/view/quick-sale-view';
import { getKV, setKV, listSales } from 'src/sections/quick-sale/quick-sale-store';
import { QuickSaleTicketView } from 'src/sections/quick-sale/view/quick-sale-ticket-view';
import {
  localId,
  syncQueue,
  enqueueSale,
  addProvisional,
  prepareOffline,
  provisionalItem,
  removeProvisional,
} from 'src/sections/quick-sale/quick-sale-sync';

import { server } from '../mocks/server';

const push = vi.fn();
vi.mock('src/routes/hooks', async (original) => ({
  ...(await original()),
  useRouter: () => ({ push, replace: vi.fn() }),
}));
vi.mock('src/layouts/dashboard', () => ({ DashboardContent: ({ children }) => children }));
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({
    user: {
      id: 3,
      email: 'a@b.mx',
      role: 'admin',
      permissions: ['sales.create', 'animals.create', 'products.create'],
    },
  }),
}));

const API = 'https://api.opuntiaden.com/api/v1';

const base = {
  image: null,
  tax_percentage: null,
  max_discount: null,
  stock: null,
  is_bundle: false,
  components: [],
  blocked_reason: null,
  animal: null,
  needs_prep: false,
  provisional: false,
  client_key: null,
  consignor_id: null,
};
const cueva = {
  ...base,
  id: 1,
  title: 'Cueva de resina',
  category: 'Decoración',
  price_retail: '80.00',
  stock: 8,
};
const musgo = { ...base, id: 2, title: 'Musgo', category: 'Sustratos', price_retail: '60.00' };
const limon = {
  ...base,
  id: 3,
  title: 'Slushie limón $100',
  category: 'Slushies',
  price_retail: '100.00',
  needs_prep: true,
};

let created; // cuerpos de POST /products/provisional
let checkouts;
let catalog;

function api({ provisional = () => null } = {}) {
  created = [];
  checkouts = [];
  server.use(
    http.get(`${API}/products/quick-sale`, () => HttpResponse.json(catalog)),
    http.get(`${API}/suppliers`, () =>
      HttpResponse.json({ data: [{ id: 9, name: 'Insectario Vecino', rfc: 'X' }] })
    ),
    http.get(`${API}/branches`, () => HttpResponse.json([{ id: 7, name: 'Matriz' }])),
    http.get(`${API}/settings/email-ticket`, () => HttpResponse.json({})),
    http.get(`${API}/settings/ticket-print`, () => HttpResponse.json({ width: 58, offset: 0 })),
    http.post(`${API}/products/provisional`, async ({ request }) => {
      const body = await request.json();
      const failure = provisional(body);
      if (failure) return failure;
      created.push(body);
      const id = 900 + created.findIndex((c) => c.client_key === body.client_key);
      return HttpResponse.json(
        { ...base, ...body, id, provisional: true, category: 'De último momento' },
        { status: 201 }
      );
    }),
    http.post(`${API}/sales/checkout`, async ({ request }) => {
      const body = await request.json();
      checkouts.push(body);
      return HttpResponse.json(
        { id: 500 + checkouts.length, total: body.payments[0]?.amount ?? 0 },
        { status: 201 }
      );
    })
  );
}

const sell = (key, item, quantity = 1) =>
  enqueueSale({
    key,
    cart: [{ product_id: item.id, quantity, discount: 0 }],
    itemsById: new Map([[item.id, item]]),
    method: 'cash',
    branchId: 7,
  });

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  catalog = [cueva, musgo, limon];
  push.mockClear();
  api();
});

// ----------------------------------------------------------------------

describe('venta rápida: productos de último momento (cola)', () => {
  it('se crea en el equipo sin red y se puede vender', async () => {
    const p = await addProvisional({ title: 'Tronco de corcho', price_retail: 120 });
    const item = provisionalItem(p);

    expect(item).toMatchObject({
      id: localId(p.client_key),
      title: 'Tronco de corcho',
      category: 'De último momento',
      stock: null,
      provisional: true,
    });
    const sale = await sell('llave-0001', item, 2);
    expect(sale.totals.total).toBe(240);
    expect(sale.lines[0].product_id).toBe(`local:${p.client_key}`);
  });

  it('al volver la red se da de alta una sola vez y sus ventas suben con el id real', async () => {
    const p = await addProvisional({
      title: 'Tronco de corcho',
      price_retail: 120,
      needs_prep: false,
      consignor_id: 9,
    });
    const item = provisionalItem(p);
    await sell('llave-0001', item, 2);
    await sell('llave-0002', item, 1);

    expect(await syncQueue()).toMatchObject({ synced: 2, pending: 0 });
    expect(created).toEqual([
      {
        client_key: p.client_key,
        title: 'Tronco de corcho',
        price_retail: 120,
        needs_prep: false,
        consignor_id: 9,
      },
    ]);
    expect(checkouts.map((c) => c.items[0].product_id)).toEqual([900, 900]);

    // una venta posterior ya no lo vuelve a dar de alta
    await sell('llave-0003', item, 1);
    await syncQueue();
    expect(created).toHaveLength(1);
    expect(checkouts[2].items[0].product_id).toBe(900);
  });

  it('si el sistema rechaza el producto, su venta queda por revisar con el motivo', async () => {
    api({ provisional: () => HttpResponse.json({ detail: 'Nombre inválido' }, { status: 400 }) });
    const item = provisionalItem(await addProvisional({ title: 'X', price_retail: 10 }));
    await sell('llave-0001', item);

    expect(await syncQueue()).toMatchObject({ synced: 0, review: 1 });
    const [sale] = await listSales();
    expect(sale.status).toBe('review');
    expect(sale.reason).toMatch(/X.*Nombre inválido/);
    expect(checkouts).toEqual([]);
  });

  it('si el alta falla por el servidor, esa venta espera y las demás suben', async () => {
    api({ provisional: () => new HttpResponse(null, { status: 500 }) });
    const item = provisionalItem(await addProvisional({ title: 'X', price_retail: 10 }));
    await sell('llave-0001', item);
    await sell('llave-0002', cueva);

    expect(await syncQueue()).toMatchObject({ synced: 1, pending: 1 });
    expect((await listSales()).map((s) => s.status)).toEqual(['pending', 'synced']);
  });

  it('sin red no se intenta subir nada', async () => {
    api({ provisional: () => HttpResponse.error() });
    const item = provisionalItem(await addProvisional({ title: 'X', price_retail: 10 }));
    await sell('llave-0001', item);
    await sell('llave-0002', cueva);

    expect(await syncQueue()).toMatchObject({ synced: 0, pending: 2 });
    expect(checkouts).toEqual([]);
  });

  it('uno que no se ha vendido se puede quitar; uno vendido no', async () => {
    const a = await addProvisional({ title: 'Error de dedo', price_retail: 1 });
    const b = await addProvisional({ title: 'Vendido', price_retail: 2 });
    await sell('llave-0001', provisionalItem(b));

    await removeProvisional(a.client_key);
    await removeProvisional(b.client_key);
    expect((await getKV('provisionals')).map((p) => p.title)).toEqual(['Vendido']);
  });

  it('preparar guarda los dueños y suelta los provisionales que ya se revisaron', async () => {
    const kept = await addProvisional({ title: 'Ya revisado', price_retail: 5 });
    const still = await addProvisional({ title: 'Sigue provisional', price_retail: 5 });
    const fresh = await addProvisional({ title: 'Aún sin subir', price_retail: 5 });
    await setKV(
      'provisionals',
      (await getKV('provisionals')).map((p) =>
        p.client_key === fresh.client_key ? p : { ...p, server_id: 950 }
      )
    );
    catalog = [
      cueva,
      {
        ...base,
        id: 950,
        title: 'Sigue provisional',
        price_retail: '5.00',
        provisional: true,
        client_key: still.client_key,
      },
      { ...base, id: 951, title: 'Ya revisado', price_retail: '5.00', client_key: kept.client_key },
    ];

    await prepareOffline({ branchId: 7, user: null });

    expect((await getKV('context')).suppliers).toEqual([{ id: 9, name: 'Insectario Vecino' }]);
    expect((await getKV('provisionals')).map((p) => p.title)).toEqual([
      'Sigue provisional',
      'Aún sin subir',
    ]);
  });

  it('en este equipo un provisional es un solo botón aunque el catálogo ya lo traiga', async () => {
    const p = await addProvisional({ title: 'Tronco de corcho', price_retail: 120 });
    await setKV('catalog', {
      items: [
        cueva,
        {
          ...base,
          id: 900,
          title: 'Tronco De Corcho',
          price_retail: '120.00',
          provisional: true,
          client_key: p.client_key,
        },
      ],
      fetchedAt: 'x',
    });
    const { result } = renderHook(() => useQuickSale());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.items.map((i) => i.id)).toEqual([1, localId(p.client_key)]);
  });

  it('con provisionales pero sin catálogo igual hay qué vender', async () => {
    await addProvisional({ title: 'Tronco de corcho', price_retail: 120 });
    const { result } = renderHook(() => useQuickSale());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.items).toHaveLength(1);
  });
});

// ----------------------------------------------------------------------

function mount() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <MemoryRouter>
        <QuickSaleView />
      </MemoryRouter>
    </SWRConfig>
  );
}
const product = (name) =>
  screen.findByRole('button', { name: new RegExp(`^Agregar ${name}`) }, { timeout: 8000 });
const cart = () => within(screen.getByRole('region', { name: 'Cuenta' }));
const names = () =>
  screen.getAllByRole('button', { name: /^Agregar / }).map((b) => b.getAttribute('aria-label'));

// «+ Alta rápida» → una de sus opciones
async function openQuick(user, option) {
  await user.click(screen.getByRole('button', { name: '+ Alta rápida' }));
  await user.click(await screen.findByRole('menuitem', { name: new RegExp(option) }));
}

describe('venta rápida: producto nuevo y buscador (pantalla)', () => {
  it('«+ Producto nuevo» lo deja como botón, lo mete a la cuenta y se cobra', async () => {
    const user = userEvent.setup();
    mount();
    await product('Musgo');
    await openQuick(user, 'Producto temporal');

    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Nombre'), 'Tronco de corcho');
    await user.type(dialog.getByLabelText('Precio'), '120,50');
    await user.click(dialog.getByLabelText('De quién es'));
    await user.click(await screen.findByRole('option', { name: 'Insectario Vecino' }));
    await user.click(dialog.getByRole('button', { name: 'Agregar a la cuenta' }));

    expect(await product('Tronco de corcho')).toBeInTheDocument();
    expect(cart().getByTestId('total')).toHaveTextContent('$120.5');

    await user.click(screen.getByRole('checkbox', { name: 'Imprimir ticket' }));
    await user.click(cart().getByRole('button', { name: /^Cobrar/ }));
    await waitFor(() => expect(checkouts).toHaveLength(1));
    expect(created[0]).toMatchObject({
      title: 'Tronco de corcho',
      price_retail: 120.5,
      consignor_id: 9,
    });
    expect(checkouts[0].items).toEqual([{ product_id: 900, quantity: 1, discount: 0 }]);
  });

  it('arriba hay un alta rápida y un alta completa, sin rutas repetidas', async () => {
    const user = userEvent.setup();
    mount();
    await product('Musgo');

    await user.click(screen.getByRole('button', { name: '+ Alta rápida' }));
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual([
      expect.stringMatching(/^Producto temporal/),
      expect.stringMatching(/^Animal/),
    ]);
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: '+ Alta completa' }));
    const animal = await screen.findByRole('menuitem', { name: /Animal/ });
    expect(animal).toHaveAttribute('href', '/dashboard/animal/new?purpose=sale&quick_sale=1');
    expect(animal).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('menuitem', { name: /Producto/ })).toHaveAttribute(
      'href',
      '/dashboard/product/new?quick_sale=1'
    );
  });

  it('la pantalla vacía ofrece los mismos botones', async () => {
    catalog = [];
    mount();
    expect(await screen.findByText(/Aún no hay productos en la venta rápida/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '+ Alta rápida' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '+ Alta completa' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '+ Agregar productos' })).toHaveLength(2);
  });

  it('el producto temporal dice que no entra al catálogo y se revisa después', async () => {
    const user = userEvent.setup();
    mount();
    await product('Musgo');
    await openQuick(user, 'Producto temporal');
    const dialog = within(await screen.findByRole('dialog', { name: 'Producto temporal' }));
    expect(dialog.getByText(/Por revisar/)).toBeInTheDocument();
  });

  it('al volver a la pestaña vuelve a bajar el catálogo (lo dado de alta en otra)', async () => {
    let fetched = 0;
    server.use(
      http.get(`${API}/products/quick-sale`, () => {
        fetched += 1;
        return HttpResponse.json(catalog);
      })
    );
    mount();
    await product('Musgo');
    await waitFor(() => expect(fetched).toBeGreaterThan(0));
    const before = fetched;
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(fetched).toBe(before + 1));
  });

  it('el nombre y el precio son obligatorios', async () => {
    const user = userEvent.setup();
    mount();
    await product('Musgo');
    await openQuick(user, 'Producto temporal');
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Agregar a la cuenta' }));

    expect(dialog.getByText('Escribe el nombre')).toBeInTheDocument();
    expect(await getKV('provisionals')).toBeUndefined();
  });

  it('el buscador filtra por nombre y categoría, sin acentos ni mayúsculas', async () => {
    const user = userEvent.setup();
    mount();
    await product('Musgo');
    const search = screen.getByRole('searchbox', { name: 'Buscar producto' });

    await user.type(search, 'musg');
    expect(names()).toHaveLength(1);
    expect(names()[0]).toMatch(/^Agregar Musgo/);

    await user.clear(search);
    await user.type(search, 'RESINA cueva');
    expect(names()[0]).toMatch(/^Agregar Cueva de resina/);
    expect(names()).toHaveLength(1);

    await user.clear(search);
    await user.type(search, 'decoracion');
    expect(names()[0]).toMatch(/^Agregar Cueva de resina/);
  });

  it('si no encuentra nada ofrece crear el producto con ese nombre', async () => {
    const user = userEvent.setup();
    mount();
    await product('Musgo');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar producto' }), 'tronco');

    expect(screen.queryByRole('button', { name: /^Agregar / })).toBeNull();
    await user.click(screen.getByRole('button', { name: '+ Producto temporal «tronco»' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByLabelText('Nombre')).toHaveValue('tronco');
  });

  it('la búsqueda se limpia al cobrar', async () => {
    const user = userEvent.setup();
    mount();
    await product('Musgo');
    const search = screen.getByRole('searchbox', { name: 'Buscar producto' });
    await user.type(search, 'musg');
    await user.click(await product('Musgo'));
    await user.click(screen.getByRole('checkbox', { name: 'Imprimir ticket' }));
    await user.click(cart().getByRole('button', { name: /^Cobrar/ }));

    await waitFor(() => expect(search).toHaveValue(''));
  });

  it('con el ticket apagado, lo que se prepara igual manda a imprimir su orden', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await product('Slushie limón'));
    await user.click(screen.getByRole('checkbox', { name: 'Imprimir ticket' }));
    await user.click(cart().getByRole('button', { name: /^Cobrar/ }));

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(push.mock.calls[0][0]).toMatch(
      /\/quick-sale\/ticket\/[0-9a-f-]{36}\?print=1&only=order$/
    );
  });

  it('sin nada que preparar y con el ticket apagado no navega', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await product('Musgo'));
    await user.click(screen.getByRole('checkbox', { name: 'Imprimir ticket' }));
    await user.click(cart().getByRole('button', { name: /^Cobrar/ }));

    await waitFor(() => expect(checkouts).toHaveLength(1));
    expect(push).not.toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------------

describe('venta rápida: talón de orden', () => {
  const mango = { ...limon, id: 4, title: 'Slushie mango $50', price_retail: '50.00' };
  const KEY = '11111111-2222-3333-4444-555555555555';

  const save = async () => {
    await enqueueSale({
      key: KEY,
      cart: [
        { product_id: 3, quantity: 3, discount: 0 },
        { product_id: 4, quantity: 2, discount: 0 },
        { product_id: 1, quantity: 1, discount: 0 },
      ],
      itemsById: new Map([limon, mango, cueva].map((i) => [i.id, i])),
      method: 'cash',
      branchId: 7,
    });
    await setKV('context', { business: {}, ticketSettings: { width: 80, offset: 0 } });
  };

  const show = (query = '') =>
    render(
      <MemoryRouter initialEntries={[`/t${query}`]}>
        <QuickSaleTicketView saleKey={KEY} />
      </MemoryRouter>
    );

  it('tras el ticket sale la orden solo con lo que se prepara, sin precios', async () => {
    await save();
    show();

    const order = within(await screen.findByTestId('prep-order'));
    expect(order.getByText('ORDEN')).toBeInTheDocument();
    expect(order.getByText('3 × Slushie limón $100')).toBeInTheDocument();
    expect(order.getByText('2 × Slushie mango $50')).toBeInTheDocument();
    expect(order.queryByText(/Cueva/)).toBeNull();
    expect(order.getByText(/^VR-/)).toBeInTheDocument();
    // el ticket del cliente sigue completo
    expect(screen.getByText('Gracias por tu compra')).toBeInTheDocument();
  });

  it('con only=order sale solo la orden', async () => {
    await save();
    show('?only=order');

    expect(await screen.findByTestId('prep-order')).toBeInTheDocument();
    expect(screen.queryByText('Gracias por tu compra')).toBeNull();
  });

  it('una venta sin nada que preparar (o guardada antes de esta versión) no trae orden', async () => {
    await enqueueSale({
      key: KEY,
      cart: [{ product_id: 1, quantity: 1, discount: 0 }],
      itemsById: new Map([[1, { ...cueva, needs_prep: undefined }]]),
      method: 'cash',
      branchId: 7,
    });
    show();

    expect(await screen.findByText('Gracias por tu compra')).toBeInTheDocument();
    expect(screen.queryByTestId('prep-order')).toBeNull();
  });
});

// ----------------------------------------------------------------------

describe('venta rápida: reparto por dueño en una venta mezclada', () => {
  const mantis = {
    ...base,
    id: 5,
    title: 'Mantis',
    category: 'Animales',
    price_retail: '300.00',
    consignor_id: 9,
  };

  beforeEach(async () => {
    catalog = [cueva, musgo, mantis];
    await setKV('context', { suppliers: [{ id: 9, name: 'Insectario Vecino' }] });
  });

  it('la cuenta dice cuánto es de cada quien, con el descuento ya aplicado', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await product('Cueva de resina'));
    // con un solo dueño no hay nada que repartir
    expect(screen.queryByText('Reparto')).toBeNull();

    await user.click(await product('Cueva de resina'));
    await user.click(await product('Mantis'));

    const split = within(await screen.findByRole('list', { name: 'Reparto' }));
    expect(split.getByText('Propio')).toBeInTheDocument();
    expect(split.getByText('$160')).toBeInTheDocument();
    expect(split.getByText('Insectario Vecino')).toBeInTheDocument();
    expect(split.getByText('$300')).toBeInTheDocument();
  });

  it('la venta guardada lleva el reparto y sale un ticket por dueño', async () => {
    const KEY = '99999999-2222-3333-4444-555555555555';
    const sale = await enqueueSale({
      key: KEY,
      cart: [
        { product_id: 1, quantity: 2, discount: 10 },
        { product_id: 5, quantity: 1, discount: 0 },
      ],
      itemsById: new Map([cueva, mantis].map((i) => [i.id, i])),
      method: 'cash',
      branchId: 7,
    });
    expect(sale.owners).toEqual([
      { consignor_id: null, name: 'Propio', total: 150 },
      { consignor_id: 9, name: 'Insectario Vecino', total: 300 },
    ]);

    render(
      <MemoryRouter>
        <QuickSaleTicketView saleKey={KEY} />
      </MemoryRouter>
    );
    // el proveedor sin prefijo propio usa P<id>; el folio propio no cambia
    expect(sale.tickets.map((t) => t.folio)).toEqual([sale.folio, expect.stringMatching(/^P9-/)]);
    expect(await screen.findByText('INSECTARIO VECINO')).toBeInTheDocument();
    expect(screen.getByText('$150.00 MXN')).toBeInTheDocument();
    expect(screen.getByText('$300.00 MXN')).toBeInTheDocument();
  });

  it('una venta de un solo dueño no lleva reparto', async () => {
    const sale = await sell('llave-0001', mantis);
    expect(sale.owners).toBeUndefined();
  });
});
