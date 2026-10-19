import { MemoryRouter } from 'react-router';
import { http, delay, HttpResponse } from 'msw';
import { it, vi, expect, describe } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { toast } from 'src/components/snackbar';

import { AnimalListView } from 'src/sections/animal/view/animal-list-view';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// «Mi criadero»: tarjetas con conteos por destino, filtro por destino,
// «Mover a…» por ejemplar y borrado múltiple de 5 en 5.
// ----------------------------------------------------------------------

vi.mock('src/layouts/dashboard', () => ({ DashboardContent: ({ children }) => children }));
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({
    user: { permissions: ['animals.create', 'animals.update', 'animals.delete'] },
  }),
}));
vi.mock('src/components/snackbar', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
// Label importa el tema completo (CSS de data-grid), que vitest no carga
vi.mock('src/components/label', () => ({ Label: ({ children }) => <span>{children}</span> }));

const API = 'https://api.opuntiaden.com/api/v1';
const page = (data) => ({ data, total: data.length, page: 1, page_size: 500, total_pages: 1 });

const GECKO = {
  id: 1,
  name: 'macularius',
  common_name: 'Gecko leopardo',
  sale_format: 'individual',
  genus: { id: 1, name: 'Eublepharis', group: { id: 1, name: 'Reptiles' } },
};
const ROACH = {
  id: 2,
  name: 'dubia',
  common_name: 'Dubia',
  sale_format: 'package',
  package_size: 6,
  genus: { id: 2, name: 'Blaptica', group: { id: 2, name: 'Insectos' } },
};

let nextId = 1;
const animal = (code, purpose, status = 'available', extra = {}) => ({
  id: nextId++,
  code,
  purpose,
  status,
  stock: 1,
  price: 500,
  sex: 'unknown',
  morphs: [],
  species_id: GECKO.id,
  species: GECKO,
  ...extra,
});

const ANIMALS = [
  animal('V-1', 'sale'),
  animal('V-2', 'sale'),
  animal('V-3', 'sale', 'reserved'),
  animal('B-1', 'breeder', 'available', { price: 0 }),
  animal('B-2', 'breeder', 'available', { price: 0 }),
  animal('C-1', 'growing', 'available', { price: 0 }),
  animal('S-1', 'sale', 'sold'),
];

function mockApi(animals = ANIMALS, extra = []) {
  server.use(
    http.get(`${API}/animals`, () => HttpResponse.json(page(animals))),
    http.get(`${API}/species`, () => HttpResponse.json(page([GECKO, ROACH]))),
    http.get(`${API}/genera`, () => HttpResponse.json(page([]))),
    http.get(`${API}/animal-groups/tree`, () => HttpResponse.json([])),
    ...extra
  );
}

function renderView() {
  const Wrapper = createWrapper();
  return render(
    <ThemeProvider theme={createTheme({ cssVariables: true })}>
      <Wrapper>
        <MemoryRouter>
          <AnimalListView />
        </MemoryRouter>
      </Wrapper>
    </ThemeProvider>
  );
}

const rowOf = (code) => screen.getByRole('link', { name: code }).closest('tr');

describe('Mi criadero', () => {
  it('muestra tarjetas con conteos por destino', async () => {
    mockApi();
    renderView();

    expect(await screen.findByRole('button', { name: /En venta\s*3/ })).toBeInTheDocument();
    expect(screen.getByText('2 disponibles · 1 apartados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pie de cría\s*2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /En crianza\s*1/ })).toBeInTheDocument();
    // el filtro también lleva su conteo
    expect(screen.getByRole('tab', { name: 'Vendidos (1)' })).toBeInTheDocument();
    // renglón de la especie con un chip por destino
    expect(screen.getByText('3 en venta')).toBeInTheDocument();
    expect(screen.getByText('2 pie de cría')).toBeInTheDocument();
  });

  it('filtrar por Pie de cría deja solo esos ejemplares', async () => {
    mockApi();
    renderView();

    await screen.findByRole('link', { name: 'V-1' });
    fireEvent.click(screen.getByRole('tab', { name: 'Pie de cría (2)' }));

    expect(screen.getByRole('link', { name: 'B-1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'B-2' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'V-1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'C-1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'S-1' })).not.toBeInTheDocument();

    // la tarjeta también filtra
    fireEvent.click(screen.getByRole('button', { name: /En crianza\s*1/ }));
    expect(screen.getByRole('link', { name: 'C-1' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'B-1' })).not.toBeInTheDocument();
  });

  it('Mover a… → Poner en venta abre el diálogo', async () => {
    mockApi();
    renderView();

    await screen.findByRole('link', { name: 'B-1' });
    const row = rowOf('B-1');
    expect(within(row).getByRole('link', { name: 'Anotar' })).toHaveAttribute(
      'href',
      '/dashboard/animal/log?species=1'
    );
    fireEvent.click(within(row).getByRole('button', { name: 'Mover a…' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Poner en venta/ }));

    expect(await screen.findByText('Mover a En venta')).toBeInTheDocument();
    // sin precio: lo pide al ponerlo en venta
    expect(screen.getByLabelText(/Precio de venta/)).toBeInTheDocument();
  });

  it('Mover a… deshabilitado para un apartado con su razón', async () => {
    mockApi();
    renderView();

    await screen.findByRole('link', { name: 'V-3' });
    fireEvent.click(within(rowOf('V-3')).getByRole('button', { name: 'Mover a…' }));

    const items = await screen.findAllByRole('menuitem');
    expect(items).toHaveLength(2);
    items.forEach((item) => {
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toHaveTextContent('Primero libera el apartado');
    });
  });

  it('paquetes en venta se cuentan en paquetes y animales; los vacíos solo en Todo', async () => {
    mockApi([
      animal('P-1', 'sale', 'available', { stock: 6, species_id: 2, species: ROACH }),
      animal('P-0', 'growing', 'available', { stock: 0, species_id: 2, species: ROACH }),
    ]);
    renderView();

    expect(await screen.findByText('6 paquetes en venta (36)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'P-0' })).toBeInTheDocument();
    expect(within(rowOf('P-0')).getByText('Vacío')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'En crianza (0)' }));
    expect(screen.queryByRole('link', { name: 'P-0' })).not.toBeInTheDocument();
  });

  it('borrado múltiple manda máximo 5 a la vez', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    let deleted = 0;
    const many = Array.from({ length: 12 }, (_, i) => animal(`M-${i + 1}`, 'sale'));
    mockApi(many, [
      http.delete(`${API}/animals/:id`, async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await delay(20);
        inFlight -= 1;
        deleted += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    ]);
    renderView();

    await screen.findByRole('link', { name: 'M-1' });
    // casilla de la cabecera: selecciona todos los de la especie
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar (12)' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('12 animales eliminados'));
    expect(deleted).toBe(12);
    expect(maxInFlight).toBeLessThanOrEqual(5);
    expect(maxInFlight).toBeGreaterThan(1);
  });
});
