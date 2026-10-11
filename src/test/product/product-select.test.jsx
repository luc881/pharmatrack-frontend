import { http, HttpResponse } from 'msw';
import { it, vi, expect, describe } from 'vitest';
import { useForm, FormProvider } from 'react-hook-form';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { ProductSelect } from 'src/sections/product/product-select';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// «+ Producto nuevo» en compras y lotes: se crea sin salir y queda elegido
// en su renglón; los otros renglones ya lo ven en la lista.
// ----------------------------------------------------------------------

vi.mock('src/components/snackbar', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const API = 'https://api.opuntiaden.com/api/v1';
const page = (data) => ({ data, total: data.length, page: 1, page_size: 100, total_pages: 1 });

function Harness() {
  const methods = useForm({ defaultValues: { items: [{ product_id: '' }, { product_id: '' }] } });
  return (
    <FormProvider {...methods}>
      <ProductSelect name="items.0.product_id" label="Producto 1" />
      <ProductSelect name="items.1.product_id" label="Producto 2" />
      <span data-testid="value">{methods.watch('items.0.product_id')}</span>
    </FormProvider>
  );
}

function renderHarness() {
  const Wrapper = createWrapper();
  return render(
    <ThemeProvider theme={createTheme({ cssVariables: true })}>
      <Wrapper>
        <Harness />
      </Wrapper>
    </ThemeProvider>
  );
}

describe('ProductSelect', () => {
  it('crea un producto desde «Producto nuevo» y lo deja elegido', async () => {
    let body = null;
    server.use(
      http.get(`${API}/products`, () => HttpResponse.json(page([{ id: 1, title: 'Sustrato' }]))),
      http.get(`${API}/productscategories`, () =>
        HttpResponse.json(page([{ id: 3, name: 'Alimento' }]))
      ),
      http.post(`${API}/products`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 9, ...body }, { status: 201 });
      })
    );
    renderHarness();

    fireEvent.click(screen.getAllByRole('button', { name: 'Producto nuevo' })[0]);
    fireEvent.change(await screen.findByLabelText('Nombre *'), {
      target: { value: 'Grillos chicos' },
    });
    const category = screen.getByRole('combobox', { name: /categoría/i });
    category.focus();
    fireEvent.mouseDown(category);
    fireEvent.change(category, { target: { value: 'Alim' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Alimento' }));
    fireEvent.change(screen.getByLabelText('Precio de venta *'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Costo *'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }));

    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('9'));
    expect(body).toEqual({
      title: 'Grillos chicos',
      product_category_id: 3,
      price_retail: 50,
      price_cost: 30,
      sku: null,
      tracks_batches: true,
    });
    expect(screen.getByRole('combobox', { name: 'Producto 1' })).toHaveValue('Grillos chicos');

    // el otro renglón ya lo tiene en su lista
    const other = screen.getByRole('combobox', { name: 'Producto 2' });
    other.focus();
    fireEvent.mouseDown(other);
    expect(await screen.findByRole('option', { name: 'Grillos chicos' })).toBeInTheDocument();
  });

  it('no crea sin categoría', async () => {
    const post = vi.fn();
    server.use(
      http.get(`${API}/products`, () => HttpResponse.json(page([]))),
      http.get(`${API}/productscategories`, () => HttpResponse.json(page([]))),
      http.post(`${API}/products`, () => {
        post();
        return HttpResponse.json({});
      })
    );
    renderHarness();

    fireEvent.click(screen.getAllByRole('button', { name: 'Producto nuevo' })[0]);
    fireEvent.change(await screen.findByLabelText('Nombre *'), { target: { value: 'Grillos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }));

    expect(await screen.findByText('Elige o crea una categoría')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
