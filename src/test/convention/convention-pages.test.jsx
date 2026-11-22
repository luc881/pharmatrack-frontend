import { SWRConfig } from 'swr';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';

import { findSection } from 'src/layouts/dashboard/section-tabs-config';

import { SaleOwnerCut } from 'src/sections/sale/sale-owner-cut';
import { ProductProvisionalView } from 'src/sections/product/view/product-provisional-view';

import { server } from '../mocks/server';

const push = vi.fn();
vi.mock('src/routes/hooks', async (original) => ({
  ...(await original()),
  useRouter: () => ({ push, replace: vi.fn() }),
}));
vi.mock('src/layouts/dashboard', () => ({ DashboardContent: ({ children }) => children }));

const API = 'https://api.opuntiaden.com/api/v1';

const wrap = (ui) =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>
  );

describe('productos por revisar', () => {
  let rows;
  let puts;

  beforeEach(() => {
    push.mockClear();
    puts = [];
    rows = [
      {
        id: 900,
        title: 'Tronco de corcho',
        price_retail: '120.00',
        is_active: true,
        needs_prep: false,
        consignor_id: 9,
        units_sold: 3,
        amount: '360.00',
      },
      {
        id: 901,
        title: 'Sin ventas',
        price_retail: '5.00',
        is_active: true,
        needs_prep: false,
        consignor_id: null,
        units_sold: 0,
        amount: '0',
      },
      {
        id: 902,
        title: 'Ya desechado',
        price_retail: '5.00',
        is_active: false,
        needs_prep: false,
        consignor_id: null,
        units_sold: 0,
        amount: '0',
      },
    ];
    server.use(
      http.get(`${API}/products/provisional`, () => HttpResponse.json(rows)),
      http.get(`${API}/suppliers`, () =>
        HttpResponse.json({ data: [{ id: 9, name: 'Insectario Vecino' }], total: 1 })
      ),
      http.put(`${API}/products/:id`, async ({ request, params }) => {
        const body = await request.json();
        puts.push([Number(params.id), body]);
        if (body.is_active === false || body.provisional === false) {
          rows = rows.filter((r) => r.id !== Number(params.id));
        }
        return HttpResponse.json({ id: Number(params.id) });
      })
    );
  });

  const row = async (name) => within((await screen.findByText(name)).closest('tr'));

  it('lista lo pendiente con lo que vendió y de quién es', async () => {
    wrap(<ProductProvisionalView />);
    const tronco = await row('Tronco de corcho');
    expect(tronco.getByText('3')).toBeInTheDocument();
    expect(tronco.getByText('$360')).toBeInTheDocument();
    expect(
      await tronco.findByRole('combobox', { name: 'De quién es Tronco de corcho' })
    ).toHaveDisplayValue('Insectario Vecino');
    expect(
      (await row('Sin ventas')).getByRole('combobox', { name: 'De quién es Sin ventas' })
    ).toHaveDisplayValue('Propio');
    expect(screen.queryByText('Ya desechado')).toBeNull();
  });

  it('«Completar y conservar» lo vuelve producto formal y abre su ficha', async () => {
    const user = userEvent.setup();
    wrap(<ProductProvisionalView />);
    await user.click(
      (await row('Tronco de corcho')).getByRole('button', { name: 'Completar y conservar' })
    );

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/product/900/edit'));
    expect(puts).toEqual([[900, { provisional: false }]]);
  });

  it('«Desechar» pide confirmación, lo desactiva y lo quita de la lista', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    wrap(<ProductProvisionalView />);

    await user.click((await row('Sin ventas')).getByRole('button', { name: 'Desechar' }));
    expect(puts).toEqual([]);

    await user.click((await row('Sin ventas')).getByRole('button', { name: 'Desechar' }));
    await waitFor(() => expect(screen.queryByText('Sin ventas')).toBeNull());
    expect(puts).toEqual([[901, { is_active: false, quick_sale: false }]]);
    confirm.mockRestore();
  });

  it('se le puede cambiar el dueño (para el corte)', async () => {
    const user = userEvent.setup();
    wrap(<ProductProvisionalView />);
    const owner = (await row('Sin ventas')).getByRole('combobox', {
      name: 'De quién es Sin ventas',
    });
    await screen.findAllByRole('option', { name: 'Insectario Vecino' });
    await user.selectOptions(owner, 'Insectario Vecino');
    await waitFor(() => expect(puts).toEqual([[901, { consignor_id: 9 }]]));
  });

  it('sin pendientes lo dice', async () => {
    rows = [];
    wrap(<ProductProvisionalView />);
    expect(await screen.findByText('No hay productos por revisar')).toBeInTheDocument();
  });

  it('tiene su pestaña en Productos', () => {
    const found = findSection('/dashboard/product/provisional');
    expect([found.section.key, found.tab.label]).toEqual(['productos', 'Por revisar']);
  });
});

describe('corte por dueño', () => {
  const cut = [
    {
      consignor_id: null,
      owner: 'Propio',
      units: 2,
      amount: '160.00',
      products: [{ product_id: 1, title: 'Cueva', units: 2, amount: '160.00' }],
    },
    {
      consignor_id: 9,
      owner: 'Insectario Vecino',
      units: 1,
      amount: '300.00',
      products: [{ product_id: 2, title: 'Mantis', units: 1, amount: '300.00' }],
    },
  ];
  let asked;

  beforeEach(() => {
    asked = [];
    server.use(
      http.get(`${API}/sales/report/by-owner`, ({ request }) => {
        const url = new URL(request.url);
        asked.push([url.searchParams.get('date_from'), url.searchParams.get('date_to')]);
        return HttpResponse.json(
          url.searchParams.get('date_from') === '2026-11-22' ? cut : [cut[0]]
        );
      })
    );
  });

  it('separa lo de cada dueño con su total y sus productos', async () => {
    wrap(<SaleOwnerCut from="2026-11-22" to="2026-11-22" />);

    const theirs = within(await screen.findByRole('region', { name: 'Insectario Vecino' }));
    expect(theirs.getAllByText('$300')).toHaveLength(2); // total y renglón
    expect(theirs.getByText('Mantis')).toBeInTheDocument();
    const mine = within(screen.getByRole('region', { name: 'Propio' }));
    expect(mine.getByText('Cueva')).toBeInTheDocument();
    expect(mine.queryByText('Mantis')).toBeNull();
    expect(asked).toEqual([['2026-11-22', '2026-11-22']]);
  });

  it('si todo lo vendido es propio no estorba', async () => {
    const { container } = wrap(<SaleOwnerCut from="2026-11-21" to="2026-11-21" />);
    await waitFor(() => expect(asked).toHaveLength(1));
    expect(container).toBeEmptyDOMElement();
  });
});
