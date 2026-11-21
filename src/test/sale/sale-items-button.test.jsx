import { SWRConfig } from 'swr';
import { it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';

import { SaleItemsButton } from 'src/sections/sale/sale-items-button';

import { server } from '../mocks/server';

const BASE = 'https://api.opuntiaden.com';

it('muestra lo vendido sin ir al detalle', async () => {
  server.use(
    http.get(`${BASE}/api/v1/saledetails`, () =>
      HttpResponse.json([
        { id: 1, sale_id: 68, product_id: 5, quantity: 2, price_unit: '85.00', discount: '0' },
        { id: 2, sale_id: 68, product_id: 9, quantity: 1, price_unit: '40.00', discount: '10' },
        { id: 3, sale_id: 70, product_id: 5, quantity: 9, price_unit: '1.00', discount: '0' },
      ])
    )
  );
  const user = userEvent.setup();
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <SaleItemsButton saleId={68} productMap={{ 5: 'Isópodo Laevis', 9: 'Musgo' }} />
    </SWRConfig>
  );

  await user.click(screen.getByRole('button', { name: 'Productos de la venta 68' }));
  const list = within(await screen.findByRole('dialog', { name: 'Venta 68' }));
  expect(await list.findByText('2× Isópodo Laevis')).toBeInTheDocument();
  expect(list.getByText('$170')).toBeInTheDocument();
  expect(list.getByText('1× Musgo')).toBeInTheDocument();
  expect(list.getByText('$30')).toBeInTheDocument();
  expect(list.queryByText(/9×/)).toBeNull();
});
