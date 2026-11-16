import { http, HttpResponse } from 'msw';
import { IDBFactory } from 'fake-indexeddb';
import { MemoryRouter } from 'react-router';
import { render, screen } from '@testing-library/react';
import { it, expect, describe, beforeEach } from 'vitest';

import { SaleTicket } from 'src/sections/sale/sale-ticket';
import { SAMPLE_TICKET } from 'src/sections/sale/print-ticket';
import { buildLocalSale } from 'src/sections/quick-sale/quick-sale-sync';
import { setKV, addSale } from 'src/sections/quick-sale/quick-sale-store';
import { QuickSaleTicketView } from 'src/sections/quick-sale/view/quick-sale-ticket-view';

import { server } from '../mocks/server';

const cueva = {
  id: 1,
  title: 'Cueva de resina',
  price_retail: '80.00',
  tax_percentage: null,
  max_discount: null,
  stock: 8,
  is_bundle: false,
  components: [],
  animal: null,
};
const filio = {
  ...cueva,
  id: 2,
  title: 'PHY-001',
  price_retail: '450.00',
  stock: 1,
  animal: {
    product_id: 2,
    species: { name: 'Gardabagusi "Argopuro"', genus: { name: 'Phyllium' } },
    morphs: [],
  },
};
const pack = {
  ...cueva,
  id: 3,
  title: '3 cuevas',
  price_retail: '200.00',
  stock: null,
  is_bundle: true,
  components: [{ product_id: 1, quantity: 3, stock: 8 }],
};
const byId = new Map([cueva, filio, pack].map((i) => [i.id, i]));

const sale = () =>
  buildLocalSale({
    key: '11111111-2222-3333-4444-555555555555',
    folio: 'VR-AB12-0007',
    soldAt: '2026-11-22T18:30:00.000Z',
    branchId: 7,
    method: 'transfer',
    cart: [
      { product_id: 1, quantity: 2, discount: 10 },
      { product_id: 2, quantity: 1, discount: 0 },
      { product_id: 3, quantity: 1, discount: 0 },
    ],
    itemsById: byId,
  });

describe('venta rápida: venta local y ticket', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('arma la venta local con todo lo necesario para subirla e imprimirla', () => {
    const s = sale();
    expect(s).toMatchObject({
      idempotency_key: '11111111-2222-3333-4444-555555555555',
      folio: 'VR-AB12-0007',
      sold_at: '2026-11-22T18:30:00.000Z',
      branch_id: 7,
      status: 'pending',
      payment: { method_payment: 'transfer', amount: 800 },
      totals: { subtotal: 800, discount: 10, tax: 0, total: 800 },
    });
    expect(s.lines[0]).toMatchObject({
      product_id: 1,
      title: 'Cueva de resina',
      quantity: 2,
      discount: 10,
      price_retail: '80.00',
      components: [],
      ticketItem: {
        cantidad: 2,
        nombre: 'Cueva de resina',
        precio_unitario: 80,
        es_cientifico: false,
      },
    });
    expect(s.lines[1].ticketItem).toMatchObject({
      nombre: 'Phyllium gardabagusi',
      es_cientifico: true,
      detalle: '“Argopuro”',
    });
    expect(s.lines[2].components).toEqual([{ product_id: 1, quantity: 3 }]);
  });

  it('el ticket imprime el folio local tal cual', () => {
    render(
      <SaleTicket
        ticket={{ ...SAMPLE_TICKET, folio: 'VR-AB12-0007' }}
        business={{ folio_prefix: 'OD' }}
      />
    );
    expect(screen.getByText('VR-AB12-0007')).toBeInTheDocument();
    expect(screen.queryByText('OD-000123')).toBeNull();
  });

  it('pinta el ticket con los datos del dispositivo, sin pedir nada a la red', async () => {
    const requests = [];
    server.use(
      http.all('*', ({ request }) => {
        requests.push(request.url);
        return HttpResponse.error();
      })
    );
    await addSale(sale());
    await setKV('context', {
      business: { business_name: 'Otro Criadero', folio_prefix: 'OC' },
      ticketSettings: { width: 58, offset: 0 },
    });

    render(
      <MemoryRouter>
        <QuickSaleTicketView saleKey="11111111-2222-3333-4444-555555555555" />
      </MemoryRouter>
    );

    expect(await screen.findByText('VR-AB12-0007')).toBeInTheDocument();
    expect(screen.getByText('OTRO CRIADERO')).toBeInTheDocument();
    expect(screen.getByText('Phyllium gardabagusi')).toHaveClass('sci');
    expect(screen.getByText('−$10.00')).toBeInTheDocument();
    // y en la línea que lo lleva, no solo en el total
    expect(screen.getByText('Descuento −$10.00')).toBeInTheDocument();
    expect(screen.getByText('$800.00 MXN')).toBeInTheDocument();
    expect(screen.getByText('Transferencia')).toBeInTheDocument();
    expect(requests).toEqual([]);
  });

  it('una venta que no está en el dispositivo lo dice', async () => {
    render(
      <MemoryRouter>
        <QuickSaleTicketView saleKey="no-existe" />
      </MemoryRouter>
    );
    expect(await screen.findByText(/no está en este dispositivo/)).toBeInTheDocument();
  });
});

// ----------------------------------------------------------------------
// Un ticket por dueño: Opuntia (consignor_id null) y BD Exóticos (id 9)
// ----------------------------------------------------------------------

const slushie = { ...cueva, id: 4, title: 'Slushie mango', price_retail: '50.00', consignor_id: 9 };
const byIdMixed = new Map([...byId, [4, slushie]]);
const BD = {
  id: 9,
  name: 'Bd Exóticos',
  logo: 'https://res.cloudinary.com/demo/image/upload/bd.png',
  ticket_prefix: 'BD',
  ticket_lines: '@bd.exoticos\nCDMX',
  ticket_qr_url: null,
};

const mixedSale = () =>
  buildLocalSale({
    key: '99999999-2222-3333-4444-555555555555',
    folio: 'VR-AB12-0008',
    ownerFolios: { 9: 'BD-AB12-0001' },
    soldAt: '2026-11-22T18:30:00.000Z',
    branchId: 7,
    method: 'cash',
    cart: [
      { product_id: 1, quantity: 1, discount: 0 },
      { product_id: 4, quantity: 2, discount: 0 },
    ],
    itemsById: byIdMixed,
    suppliers: [BD],
  });

describe('venta rápida: un ticket por dueño', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('la venta mezclada guarda un ticket por dueño, con su folio y su total', () => {
    const s = mixedSale();
    expect(s.totals.total).toBe(180);
    expect(s.lines.map((l) => l.consignor_id)).toEqual([null, 9]);
    expect(s.tickets).toEqual([
      { consignor_id: null, folio: 'VR-AB12-0008', totals: expect.objectContaining({ total: 80 }) },
      { consignor_id: 9, folio: 'BD-AB12-0001', totals: expect.objectContaining({ total: 100 }) },
    ]);
  });

  it('una venta solo de lo propio no cambia', () => {
    expect(sale().tickets).toBeUndefined();
  });

  it('imprime un ticket por marca, cada uno con su logo, sus datos y sus productos', async () => {
    await addSale(mixedSale());
    await setKV('context', {
      business: { business_name: 'Opuntia Den', folio_prefix: 'OD' },
      ticketSettings: { width: 58, offset: 0 },
      suppliers: [BD],
    });

    render(
      <MemoryRouter>
        <QuickSaleTicketView saleKey="99999999-2222-3333-4444-555555555555" />
      </MemoryRouter>
    );

    expect(await screen.findByText('VR-AB12-0008')).toBeInTheDocument();
    expect(screen.getByText('BD-AB12-0001')).toBeInTheDocument();
    expect(screen.getByText('OPUNTIA DEN')).toBeInTheDocument();
    expect(screen.getByText('BD EXÓTICOS')).toBeInTheDocument();
    expect(screen.getByAltText('Bd Exóticos')).toHaveAttribute('src', BD.logo);
    expect(screen.getByText('@bd.exoticos')).toBeInTheDocument();
    expect(screen.getByText('CDMX')).toBeInTheDocument();

    const [own, bd] = document.querySelectorAll('.od-ticket:not(.od-order)');
    expect(own).toHaveTextContent('Cueva de resina');
    expect(own).not.toHaveTextContent('Slushie mango');
    expect(own).toHaveTextContent('$80.00 MXN');
    expect(bd).toHaveTextContent('Slushie mango');
    expect(bd).not.toHaveTextContent('Cueva de resina');
    expect(bd).toHaveTextContent('$100.00 MXN');
    // cada ticket es de un solo dueño: ya no lleva «Reparto»
    expect(screen.queryByText('Propio')).toBeNull();
  });
});
