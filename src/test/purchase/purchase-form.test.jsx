import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { it, vi, expect, describe } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { PurchaseCreateEditForm } from 'src/sections/purchase/purchase-create-edit-form';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// La compra se guarda en una sola llamada con sus renglones (la API los suma
// al stock); un producto de venta libre no pide lote ni vencimiento.
// ----------------------------------------------------------------------

vi.mock('src/components/snackbar', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => ({ user: { id: 1 } }) }));

const API = 'https://api.opuntiaden.com/api/v1';
const page = (data) => ({ data, total: data.length, page: 1, page_size: 500, total_pages: 1 });

describe('PurchaseCreateEditForm', () => {
  it('editar manda los renglones dentro de la compra; venta libre sin lote', async () => {
    let body = null;
    server.use(
      http.get(`${API}/suppliers`, () => HttpResponse.json(page([{ id: 2, name: 'Bioterio' }]))),
      http.get(`${API}/products`, () =>
        HttpResponse.json(
          page([
            { id: 1, title: 'Grillos', tracks_batches: true },
            { id: 4, title: 'Corteza a granel', tracks_batches: false },
          ])
        )
      ),
      http.put(`${API}/purchases/5`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 5 });
      })
    );
    const Wrapper = createWrapper();
    render(
      <ThemeProvider theme={createTheme({ cssVariables: true })}>
        <MemoryRouter>
          <Wrapper>
            <PurchaseCreateEditForm
              currentPurchase={{ id: 5, supplier_id: 2, date_emision: '2026-10-01T00:00:00' }}
              currentDetails={[
                { id: 7, product_id: 1, quantity: 10, unit_price: 3, lot_code: 'L1' },
                { id: 8, product_id: 4, quantity: 2.5, unit_price: 40 },
              ]}
            />
          </Wrapper>
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(await screen.findByText(/Venta libre: no lleva inventario/)).toBeInTheDocument();
    expect(screen.getAllByLabelText('Lote (opcional)')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      supplier_id: 2,
      user_id: 1,
      total: 130,
      date_emision: '2026-10-01T00:00:00',
      items: [
        { product_id: 1, quantity: 10, unit_price: 3, lot_code: 'L1', expiration_date: null },
        { product_id: 4, quantity: 2.5, unit_price: 40, lot_code: null, expiration_date: null },
      ],
    });
  });
});
