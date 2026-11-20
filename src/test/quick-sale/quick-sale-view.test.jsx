import { SWRConfig } from 'swr';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { IDBFactory } from 'fake-indexeddb';
import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';

import { QuickSaleStatus } from 'src/sections/quick-sale/quick-sale-status';
import { getKV, listSales } from 'src/sections/quick-sale/quick-sale-store';
import { QuickSaleView } from 'src/sections/quick-sale/view/quick-sale-view';

import { server } from '../mocks/server';

// El layout importa el tema completo (CSS de data-grid), que vitest no carga
vi.mock('src/layouts/dashboard', () => ({ DashboardContent: ({ children }) => children }));
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({
    user: { id: 3, email: 'a@b.mx', role: 'admin', permissions: ['sales.create'] },
  }),
}));

const BASE = 'https://api.opuntiaden.com';

const cueva = {
  id: 1,
  title: 'Cueva de resina',
  image: null,
  category: 'Decoración',
  price_retail: '80.00',
  tax_percentage: null,
  max_discount: 10,
  stock: 8,
  is_bundle: false,
  components: [],
  blocked_reason: null,
  animal: null,
};
const musgo = {
  ...cueva,
  id: 2,
  title: 'Musgo',
  price_retail: '60.00',
  stock: 0,
  max_discount: null,
};
const pack = {
  ...cueva,
  id: 3,
  title: '3 cuevas',
  price_retail: '200.00',
  stock: null,
  max_discount: null,
  is_bundle: true,
  components: [{ product_id: 1, quantity: 3, stock: 8 }],
};

let checkouts;

function mount(items = [cueva, musgo, pack]) {
  checkouts = [];
  server.use(
    http.get(`${BASE}/api/v1/products/quick-sale`, () =>
      items ? HttpResponse.json(items) : HttpResponse.error()
    ),
    http.get('https://res.cloudinary.com/*', () => HttpResponse.error()),
    http.get(`${BASE}/api/v1/branches`, () => HttpResponse.json([{ id: 7, name: 'Matriz' }])),
    http.get(`${BASE}/api/v1/settings/email-ticket`, () => HttpResponse.json({})),
    http.get(`${BASE}/api/v1/settings/ticket-print`, () =>
      HttpResponse.json({ width: 58, offset: 0, saved: true })
    ),
    http.post(`${BASE}/api/v1/sales/checkout`, async ({ request }) => {
      const body = await request.json();
      checkouts.push(body);
      return HttpResponse.json({ id: 501, total: body.payments[0].amount }, { status: 201 });
    })
  );
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <MemoryRouter>
        <QuickSaleView />
      </MemoryRouter>
    </SWRConfig>
  );
}

// El primer render carga todo el módulo: con la suite completa en paralelo
// tarda más que el segundo que da findBy por omisión
const product = (name) =>
  screen.findByRole('button', { name: new RegExp(`^Agregar ${name}`) }, { timeout: 8000 });
const cart = () => within(screen.getByRole('region', { name: 'Cuenta' }));

describe('venta rápida: pantalla', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('cada toque suma uno y actualiza el total', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await product('Cueva de resina'));
    await user.click(await product('Cueva de resina'));

    expect(cart().getByText('2×')).toBeInTheDocument();
    expect(cart().getByTestId('total')).toHaveTextContent('$160');
  });

  it('un producto agotado no se puede tocar', async () => {
    mount();
    expect(await product('Musgo')).toBeDisabled();
    expect(screen.getByText('Agotado')).toBeInTheDocument();
  });

  it('un descuento arriba del tope no se aplica', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await product('Cueva de resina'));
    await user.click(cart().getByRole('button', { name: 'Descuento' }));

    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Descuento'), '20');
    await user.click(dialog.getByRole('button', { name: 'Aplicar' }));

    expect(await dialog.findByText(/descuento máximo/i)).toBeInTheDocument();
    // con el diálogo abierto la cuenta queda oculta para lectores de pantalla
    expect(screen.getByTestId('total')).toHaveTextContent('$80');
  });

  it('cobrar manda la venta y deja la cuenta vacía', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await product('Cueva de resina'));
    await user.click(await product('3 cuevas'));
    await user.click(screen.getByRole('checkbox', { name: 'Imprimir ticket' }));
    await user.click(cart().getByRole('button', { name: /^Cobrar/ }));

    await waitFor(() => expect(checkouts).toHaveLength(1));
    expect(checkouts[0]).toMatchObject({
      branch_id: 7,
      items: [
        { product_id: 1, quantity: 1, discount: 0 },
        { product_id: 3, quantity: 1, discount: 0 },
      ],
      payments: [{ method_payment: 'cash', amount: 280 }],
    });
    expect(checkouts[0].idempotency_key).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() =>
      expect(cart().getByText('Toca un producto para empezar')).toBeInTheDocument()
    );
  });

  it('dos toques seguidos en cobrar hacen una sola venta', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await product('Cueva de resina'));
    await user.click(screen.getByRole('checkbox', { name: 'Imprimir ticket' }));
    await user.dblClick(cart().getByRole('button', { name: /^Cobrar/ }));

    await waitFor(() =>
      expect(cart().getByText('Toca un producto para empezar')).toBeInTheDocument()
    );
    // la subida corre aparte: se espera a que llegue y se revisa que fue una
    await waitFor(() => expect(checkouts).toHaveLength(1));
    expect(await listSales()).toHaveLength(1);
  });

  it('«Reimprimir ticket» lista las ventas del equipo y abre su ticket, sin red', async () => {
    const user = userEvent.setup();
    mount();
    expect(await screen.findByRole('button', { name: 'Reimprimir ticket' })).toBeDisabled();

    await user.click(await product('Cueva de resina'));
    await user.click(screen.getByRole('checkbox', { name: 'Imprimir ticket' }));
    server.use(http.post(`${BASE}/api/v1/sales/checkout`, () => HttpResponse.error()));
    await user.click(cart().getByRole('button', { name: /^Cobrar/ }));
    await screen.findByText(/1 por subir/);

    await user.click(screen.getByRole('button', { name: 'Reimprimir ticket' }));
    const item = await screen.findByRole('menuitem', { name: /VR-\w+-0001.*\$80/ });
    const [sale] = await listSales();
    expect(item).toHaveAttribute(
      'href',
      `/dashboard/quick-sale/ticket/${sale.idempotency_key}?print=1`
    );
  });

  it('sin productos marcados invita a agregarlos', async () => {
    mount([]);
    expect(await screen.findByText(/Aún no hay productos/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '+ Agregar productos' }).length).toBeGreaterThan(
      0
    );
  });
  it('sin preparar y sin red explica qué hacer', async () => {
    mount(null);

    expect(
      await screen.findByText(/Prepara la venta rápida con internet antes de salir/)
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Agregar / })).toBeNull();
  });

  it('sin red la venta se guarda en el equipo y aparta su stock', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await product('Cueva de resina'));
    await user.click(screen.getByRole('checkbox', { name: 'Imprimir ticket' }));
    server.use(http.post(`${BASE}/api/v1/sales/checkout`, () => HttpResponse.error()));
    await user.click(cart().getByRole('button', { name: /^Cobrar/ }));

    expect(await screen.findByText(/1 por subir/)).toBeInTheDocument();
    expect(cart().getByText('Toca un producto para empezar')).toBeInTheDocument();
    expect(await product('Cueva de resina')).toHaveTextContent('Quedan 7');
    expect(screen.getByText(/No borres los datos del navegador/)).toBeInTheDocument();
  });

  it('una venta rechazada muestra el motivo y se puede reintentar', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await product('Cueva de resina'));
    await user.click(screen.getByRole('checkbox', { name: 'Imprimir ticket' }));
    let reject = true;
    server.use(
      http.post(`${BASE}/api/v1/sales/checkout`, () =>
        reject
          ? HttpResponse.json(
              { detail: 'Stock insuficiente para Cueva de resina' },
              { status: 400 }
            )
          : HttpResponse.json({ id: 9, total: '80.00' }, { status: 201 })
      )
    );
    await user.click(cart().getByRole('button', { name: /^Cobrar/ }));

    expect(await screen.findByText('Stock insuficiente para Cueva de resina')).toBeInTheDocument();
    expect(screen.getByText(/1 por revisar/)).toBeInTheDocument();

    reject = false;
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.queryByText(/por revisar/)).toBeNull());
  });
  it('recuerda la sucursal en el equipo para poder cobrar sin red', async () => {
    mount();
    await product('Cueva de resina');
    await waitFor(async () => expect((await getKV('prefs'))?.branchId).toBe(7));
  });

  it('«Recibí» acepta coma decimal', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await product('Cueva de resina'));
    await user.type(cart().getByLabelText('Recibí'), '100,50');
    expect(cart().getByText(/^\$20\.50?$/)).toBeInTheDocument();
  });

  it('el botón del producto dice precio y existencias al lector de pantalla', async () => {
    mount();
    expect(await product('Cueva de resina')).toHaveAccessibleName(
      'Agregar Cueva de resina, $80, Quedan 8'
    );
    expect(await product('Musgo')).toHaveAccessibleName('Agregar Musgo, $60, Agotado');
  });

  it('una venta rechazada se puede descartar y deja de apartar stock', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mount();
    await user.click(await product('Cueva de resina'));
    await user.click(screen.getByRole('checkbox', { name: 'Imprimir ticket' }));
    server.use(
      http.post(`${BASE}/api/v1/sales/checkout`, () =>
        HttpResponse.json({ detail: 'Stock insuficiente' }, { status: 400 })
      )
    );
    await user.click(cart().getByRole('button', { name: /^Cobrar/ }));
    expect(await screen.findByText(/1 por revisar/)).toBeInTheDocument();
    expect(await product('Cueva de resina')).toHaveTextContent('Quedan 7');

    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(screen.queryByText(/por revisar/)).toBeNull());
    expect(confirm).toHaveBeenCalled();
    expect(await product('Cueva de resina')).toHaveTextContent('Quedan 8');
    expect(await listSales()).toEqual([]);
    confirm.mockRestore();
  });

  it('con wifi pero sin llegar al sistema no dice «Con conexión»', async () => {
    mount(null);
    expect(await screen.findByText(/Sin conexión con el sistema/)).toBeInTheDocument();
    expect(screen.queryByText('Con conexión')).toBeNull();
  });

  it('avisa mientras la app todavía se está guardando en el equipo', async () => {
    render(
      <MemoryRouter>
        <QuickSaleStatus
          online
          shellReady={false}
          count={4}
          fetchedAt="2026-11-22T18:00:00.000Z"
          counts={{ pending: 0, review: 0 }}
          sales={[]}
        />
      </MemoryRouter>
    );
    expect(screen.getByText(/todavía se está guardando/)).toBeInTheDocument();
    expect(screen.queryByText(/Listo para vender sin internet/)).toBeNull();
  });
});
