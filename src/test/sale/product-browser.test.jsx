import { http, HttpResponse } from 'msw';
import { it, vi, expect, describe } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { ProductBrowserDialog } from 'src/sections/sale/product-browser-dialog';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// Nueva venta → «Ver catálogo»: todos los productos por páginas, buscar por
// palabras y filtrar por dueño (los míos o los de otro expositor).
// ----------------------------------------------------------------------

// Label importa el tema completo (CSS de data-grid), que vitest no carga
vi.mock('src/components/label', () => ({ Label: ({ children }) => <span>{children}</span> }));

const API = 'https://api.opuntiaden.com/api/v1';
const page = (data) => ({ data, total: data.length, page: 1, page_size: 500, total_pages: 1 });

const MINE = Array.from({ length: 28 }, (_, i) => ({
  id: i + 1,
  title: `Sustrato ${String(i + 1).padStart(2, '0')}`,
  price_retail: 100,
  product_category_id: 1,
  consignor_id: null,
}));
const BD = [
  { id: 100, title: 'Slush de mango', price_retail: 50, product_category_id: 2, consignor_id: 7, tracks_batches: false },
  { id: 101, title: 'Pitón bola Clown Pied', price_retail: 30000, product_category_id: 3, consignor_id: 7 },
];
const OTHER = [{ id: 200, title: 'Mantis orquídea', price_retail: 900, product_category_id: 3, consignor_id: 8 }];
const PRODUCTS = [...MINE, ...BD, ...OTHER];

function renderBrowser(props = {}) {
  server.use(
    http.get(`${API}/suppliers`, () =>
      HttpResponse.json(page([{ id: 7, name: 'BD Exoticos' }, { id: 8, name: 'Otro' }]))
    ),
    http.get(`${API}/productscategories`, () =>
      HttpResponse.json(
        page([
          { id: 1, name: 'Sustratos' },
          { id: 2, name: 'Bebidas' },
          { id: 3, name: 'Animales' },
        ])
      )
    )
  );
  const onAdd = vi.fn();
  const Wrapper = createWrapper();
  render(
    <ThemeProvider theme={createTheme({ cssVariables: true })}>
      <Wrapper>
        <ProductBrowserDialog
          open
          products={PRODUCTS}
          productIdsWithStock={new Set(PRODUCTS.map((p) => p.id))}
          blockedProducts={new Map()}
          inCart={new Map()}
          onAdd={onAdd}
          onClose={() => {}}
          {...props}
        />
      </Wrapper>
    </ThemeProvider>
  );
  return { onAdd, user: userEvent.setup() };
}

const titles = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent);

describe('Nueva venta: catálogo de productos', () => {
  it('muestra todos por páginas, sin tener que escribir', async () => {
    const { user } = renderBrowser();
    expect(screen.getByText('31 productos')).toBeInTheDocument();
    expect(titles()).toHaveLength(25);
    await user.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(titles()).toHaveLength(6);
  });

  it('busca por palabras en cualquier orden y sin acentos', async () => {
    const { user } = renderBrowser();
    await user.type(screen.getByLabelText('Buscar'), 'pied piton');
    expect(titles()).toEqual([expect.stringContaining('Pitón bola Clown Pied')]);
  });

  it('filtra lo que no es mío y lo de un proveedor', async () => {
    const { user } = renderBrowser();
    await user.click(await screen.findByRole('combobox', { name: 'Dueño' }));
    await user.click(screen.getByRole('option', { name: 'De otros (no míos)' }));
    expect(titles()).toHaveLength(3);
    expect(screen.getAllByText('BD Exoticos').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('combobox', { name: 'Dueño' }));
    await user.click(screen.getByRole('option', { name: 'Otro' }));
    expect(titles()).toEqual([expect.stringContaining('Mantis orquídea')]);

    await user.click(screen.getByRole('combobox', { name: 'Dueño' }));
    await user.click(screen.getByRole('option', { name: 'Míos' }));
    expect(screen.getByText('28 productos')).toBeInTheDocument();
  });

  it('«Agregar» lo pone en la venta', async () => {
    const { user, onAdd } = renderBrowser();
    await user.type(screen.getByLabelText('Buscar'), 'slush');
    await user.click(screen.getByRole('button', { name: 'Agregar Slush de mango' }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 100 }));
  });
});
