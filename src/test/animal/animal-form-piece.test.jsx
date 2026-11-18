import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { it, vi, expect, describe } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { AnimalCreateEditForm } from 'src/sections/animal/animal-create-edit-form';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// Formato «Por pieza» desde el formulario (con permiso de editar especies).
// ----------------------------------------------------------------------

vi.mock('src/layouts/dashboard', () => ({ DashboardContent: ({ children }) => children }));
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({
    user: { permissions: ['animals.create', 'animals.update', 'species.update'] },
  }),
}));
vi.mock('src/components/snackbar', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
// el índice arrastra el data-grid (CSS que vitest no carga): solo se necesita la ficha
vi.mock('src/sections/animal/view', async () => ({
  AnimalDetailsView: (await import('src/sections/animal/view/animal-details-view'))
    .AnimalDetailsView,
}));
vi.mock('src/components/label', () => ({ Label: ({ children }) => <span>{children}</span> }));

const API = 'https://api.opuntiaden.com/api/v1';
const page = (data) => ({ data, total: data.length, page: 1, page_size: 500, total_pages: 1 });

const GECKO = {
  id: 1,
  name: 'macularius',
  common_name: 'Gecko leopardo',
  sale_format: 'individual',
  genus_id: 1,
  genus: { id: 1, name: 'Eublepharis', group: { id: 1, name: 'Reptiles' } },
};

function mockApi(extra = []) {
  server.use(
    http.get(`${API}/species`, () => HttpResponse.json(page([GECKO]))),
    http.get(`${API}/genera`, () => HttpResponse.json(page([GECKO.genus]))),
    http.get(`${API}/morphs`, () =>
      HttpResponse.json(page([{ id: 5, name: 'Tangerine', species_id: 1 }]))
    ),
    http.get(`${API}/animal-groups/tree`, () => HttpResponse.json([])),
    ...extra
  );
}

const wrap = (ui, entry = '/') => {
  const Wrapper = createWrapper();
  return render(
    <ThemeProvider theme={createTheme({ cssVariables: true })}>
      <Wrapper>
        <MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>
      </Wrapper>
    </ThemeProvider>
  );
};

const capture = (method, path, body) =>
  http[method](`${API}${path}`, async ({ request }) => {
    body.sent = await request.json();
    return HttpResponse.json({ id: 9 });
  });

describe('Formulario de animal: formato «Por pieza»', () => {
  it('pasar la especie a «Por pieza» solo cambia el formato (el registro se junta en su lote)', async () => {
    const species = {};
    const animal = {};
    mockApi([capture('put', '/species/1', species), capture('put', '/animals/7', animal)]);
    const current = {
      id: 7,
      code: 'PHY-7',
      purpose: 'sale',
      status: 'available',
      species_id: 1,
      species: GECKO,
      price: 350,
      stock: 1,
      morphs: [],
      photos: [],
    };
    wrap(<AnimalCreateEditForm currentAnimal={current} />);

    fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Formato de venta' }));
    fireEvent.click(await screen.findByRole('option', { name: /^Por pieza/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(species.sent).toMatchObject({ sale_format: 'piece' }));
    await new Promise((r) => setTimeout(r, 300));
    expect(animal.sent).toBeUndefined();
  });
});

describe('Formulario de animal: qué significa cada formato', () => {
  it('debajo del formato dice qué es el que está elegido', async () => {
    mockApi();
    wrap(<AnimalCreateEditForm />, '/new?species_id=1&purpose=sale');

    expect(await screen.findByText(/Cada animal es único, con su propio código/)).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Formato de venta' }));
    fireEvent.click(await screen.findByRole('option', { name: /^Por pieza/ }));
    await waitFor(() =>
      expect(screen.getAllByText(/Animales iguales que se venden de uno en uno/).length).toBeGreaterThan(0)
    );
  });
});
