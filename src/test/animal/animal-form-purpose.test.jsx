import { http, HttpResponse } from 'msw';
import { it, vi, expect, describe } from 'vitest';
import { Route, Routes, MemoryRouter } from 'react-router';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import DetailsPage from 'src/pages/dashboard/animal/details';

import { AnimalCreateEditForm } from 'src/sections/animal/animal-create-edit-form';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// Destino («¿Para qué es?») al dar de alta, al editar y en la ficha.
// ----------------------------------------------------------------------

vi.mock('src/layouts/dashboard', () => ({ DashboardContent: ({ children }) => children }));
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({
    user: { permissions: ['animals.create', 'animals.update'] },
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
    http.get(`${API}/morphs`, () => HttpResponse.json(page([]))),
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

describe('Formulario de animal: destino', () => {
  it('al crear como Pie de cría no pide precio y manda purpose breeder, price 0', async () => {
    const body = {};
    mockApi([capture('post', '/animals', body)]);
    wrap(<AnimalCreateEditForm />, '/new?species_id=1');

    fireEvent.click(await screen.findByRole('radio', { name: /Pie de cría/ }));
    expect(screen.getByText('Reproductores; no se venden.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Precio de venta/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Precio anterior/)).not.toBeInTheDocument();
    // los papeles legales siguen a la vista
    expect(screen.getByText(/Requiere documentación legal/)).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByLabelText(/Especie/)).toHaveValue('macularius — Gecko leopardo')
    );
    fireEvent.click(screen.getByRole('button', { name: 'Registrar animal' }));

    await waitFor(() => expect(body.sent).toBeDefined());
    expect(body.sent).toMatchObject({ purpose: 'breeder', price: 0, species_id: 1 });
  });

  it('preselecciona el destino desde ?purpose=growing', async () => {
    mockApi();
    wrap(<AnimalCreateEditForm />, '/new?purpose=growing');

    expect(await screen.findByRole('radio', { name: /En crianza/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /En venta/ })).not.toBeChecked();
  });

  it('al editar no manda purpose', async () => {
    const body = {};
    mockApi([capture('put', '/animals/5', body)]);
    const current = {
      id: 5,
      code: 'B-1',
      purpose: 'breeder',
      status: 'available',
      species_id: 1,
      species: GECKO,
      price: 0,
      stock: 1,
      sex: 'female',
      morphs: [],
      photos: [],
    };
    wrap(<AnimalCreateEditForm currentAnimal={current} />);

    expect(await screen.findByRole('button', { name: 'Mover a…' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Precio de venta/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(body.sent).toBeDefined());
    expect(body.sent).not.toHaveProperty('purpose');
  });
});

describe('Ficha del ejemplar', () => {
  it('ficha de un ejemplar que no existe muestra el mensaje y el enlace', async () => {
    server.use(
      http.get(`${API}/animals/99`, () =>
        HttpResponse.json({ detail: 'Animal not found.' }, { status: 404 })
      )
    );
    const Wrapper = createWrapper();
    render(
      <ThemeProvider theme={createTheme({ cssVariables: true })}>
        <Wrapper>
          <MemoryRouter initialEntries={['/dashboard/animal/99']}>
            <Routes>
              <Route path="/dashboard/animal/:id" element={<DetailsPage />} />
            </Routes>
          </MemoryRouter>
        </Wrapper>
      </ThemeProvider>
    );

    expect(await screen.findByText('Este ejemplar ya no existe')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a Mi criadero' })).toHaveAttribute(
      'href',
      '/dashboard/animal'
    );
  });
});
