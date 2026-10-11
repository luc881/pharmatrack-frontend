import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { it, vi, expect, describe } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { toast } from 'src/components/snackbar';

import { HusbandryLogView } from 'src/sections/animal/view/husbandry-log-view';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// Bitácora de manejo: especies con plan arriba; tocar una abre el formulario.
// ----------------------------------------------------------------------

vi.mock('src/layouts/dashboard', () => ({ DashboardContent: ({ children }) => children }));
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: { permissions: ['animals.update'] } }),
}));
// Label importa el tema completo (CSS de data-grid), que vitest no carga
vi.mock('src/components/snackbar', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('src/components/label', () => ({ Label: ({ children }) => <span>{children}</span> }));

const API = 'https://api.opuntiaden.com/api/v1';
const SPECIES = { id: 7, name: 'gardabagusi', common_name: 'Hoja', genus: { name: 'Phyllium' } };
const PLAN = [
  { kind: 'supplement', name: 'Calcio', every_days: 7 },
  { kind: 'food', name: 'Zarzamora', every_days: 2 },
];
const page = (data) => ({ data, total: data.length, page: 1, page_size: 100, total_pages: 1 });

function renderView() {
  const Wrapper = createWrapper();
  return render(
    <ThemeProvider theme={createTheme({ cssVariables: true })}>
      <Wrapper>
        <MemoryRouter>
          <HusbandryLogView />
        </MemoryRouter>
      </Wrapper>
    </ThemeProvider>
  );
}

function mockApi({ species = [SPECIES], status = [], animals = [], onSave }) {
  server.use(
    http.get(`${API}/species`, () => HttpResponse.json(page(species))),
    http.get(`${API}/genera`, () => HttpResponse.json(page([]))),
    http.get(`${API}/animal-groups/tree`, () => HttpResponse.json([])),
    http.get(`${API}/morphs`, () => HttpResponse.json(page([]))),
    http.get(`${API}/husbandry-logs`, () => HttpResponse.json(page([]))),
    http.get(`${API}/husbandry-logs/status`, () => HttpResponse.json(status)),
    http.get(`${API}/animals`, () => HttpResponse.json(page(animals))),
    http.post(`${API}/husbandry-logs`, async ({ request }) => {
      const body = await request.json();
      onSave?.(body);
      return HttpResponse.json({ id: 1, ...body }, { status: 201 });
    })
  );
}

describe('HusbandryLogView', () => {
  it('sin planes explica cómo agregarlos y deja anotar en cualquier especie', async () => {
    let saved = null;
    mockApi({ onSave: (b) => (saved = b) });
    renderView();

    expect(await screen.findByText(/ninguna especie tiene plan/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /anotar sin plan/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Anotar' }));
    fireEvent.click(await screen.findByRole('button', { name: /sí comió/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved).toMatchObject({
      species_id: 7,
      morph_id: null,
      fed: true,
      food_type: null,
      pieces: null,
      grams: null,
      appetite: null,
      activities: [],
      supplement: null,
      deaths: null,
      animal_id: null,
      photos: [],
    });
    expect(saved.log_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('no guarda una entrada vacía', async () => {
    let saved = null;
    mockApi({ species: [{ ...SPECIES, husbandry_plan: PLAN }], onSave: (b) => (saved = b) });
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: 'Anotar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/marca si comió/i))
    );
    expect(saved).toBeNull();
  });

  it('muestra el plan con lo que toca y las bajas descuentan del ejemplar', async () => {
    let saved = null;
    const status = [
      {
        species_id: 7,
        species_name: 'Phyllium gardabagusi',
        common_name: 'Hoja',
        last_fed: null,
        month: {},
        plan: [
          {
            kind: 'supplement',
            name: 'Calcio',
            every_days: 7,
            last_done: null,
            next_due: '2026-10-10',
            days_overdue: 2,
          },
          {
            kind: 'food',
            name: 'Zarzamora',
            every_days: 2,
            last_done: null,
            next_due: '2026-10-20',
            days_overdue: -8,
          },
        ],
      },
    ];
    mockApi({
      species: [{ ...SPECIES, husbandry_plan: PLAN }],
      status,
      animals: [{ id: 55, code: 'AN-55', stock: 10, morphs: [] }],
      onSave: (b) => (saved = b),
    });
    renderView();

    expect(await screen.findByText('Atrasado 2 d')).toBeInTheDocument();
    expect(screen.getByText('En 8 días')).toBeInTheDocument();
    // solo lo que ya toca lleva «Hecho»
    expect(screen.getAllByRole('button', { name: 'Hecho' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Anotar' }));
    fireEvent.click(await screen.findByRole('button', { name: /más detalles/i }));
    fireEvent.change(screen.getByLabelText('Bajas'), { target: { value: '2' } });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /descontar del inventario/i }));
    fireEvent.click(await screen.findByText(/AN-55/));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved).toMatchObject({ species_id: 7, fed: false, deaths: 2, animal_id: 55 });
  });

  it('«Hecho» registra el renglón del plan de un toque', async () => {
    let saved = null;
    const status = [
      {
        species_id: 7,
        species_name: 'Phyllium gardabagusi',
        common_name: 'Hoja',
        last_fed: null,
        month: {},
        plan: [
          {
            kind: 'food',
            name: 'Zarzamora',
            every_days: 2,
            last_done: null,
            next_due: '2026-10-10',
            days_overdue: 0,
          },
        ],
      },
    ];
    mockApi({
      species: [{ ...SPECIES, husbandry_plan: [PLAN[1]] }],
      status,
      onSave: (b) => (saved = b),
    });
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: 'Hecho' }));

    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved).toMatchObject({
      species_id: 7,
      fed: true,
      food_type: 'Zarzamora',
      supplement: null,
    });
  });
});
