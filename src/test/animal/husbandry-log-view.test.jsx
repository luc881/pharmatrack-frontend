import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { it, vi, expect, describe } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { HusbandryLogView } from 'src/sections/animal/view/husbandry-log-view';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// Bitácora de manejo: la palomita sola guarda; los vacíos van como null.
// ----------------------------------------------------------------------

vi.mock('src/layouts/dashboard', () => ({ DashboardContent: ({ children }) => children }));
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => ({ user: { permissions: ['animals.update'] } }) }));
// Label importa el tema completo (CSS de data-grid), que vitest no carga
vi.mock('src/components/label', () => ({ Label: ({ children }) => children }));

const API = 'https://api.opuntiaden.com/api/v1';
const SPECIES = { id: 7, name: 'gardabagusi', common_name: 'Hoja', genus: { name: 'Phyllium' } };
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

describe('HusbandryLogView', () => {
  it('guarda solo la palomita con la especie elegida', async () => {
    let saved = null;
    server.use(
      http.get(`${API}/species`, () => HttpResponse.json(page([SPECIES]))),
      http.get(`${API}/morphs`, () => HttpResponse.json(page([]))),
      http.get(`${API}/husbandry-logs`, () => HttpResponse.json(page([]))),
      http.get(`${API}/husbandry-logs/status`, () => HttpResponse.json([])),
      http.get(`${API}/animals`, () => HttpResponse.json(page([]))),
      http.post(`${API}/husbandry-logs`, async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json({ id: 1, ...saved }, { status: 201 });
      })
    );
    renderView();

    const speciesInput = screen.getByRole('combobox', { name: /^especie/i });
    fireEvent.mouseDown(speciesInput);
    fireEvent.click(await screen.findByText('Hoja (Phyllium gardabagusi)'));
    fireEvent.click(screen.getByRole('checkbox', { name: /comió/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar entrada/i }));

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

  it('«Registrar» desde el plan llena el formulario y las bajas descuentan del ejemplar', async () => {
    let saved = null;
    const status = [
      {
        species_id: 7,
        species_name: 'Phyllium gardabagusi',
        common_name: 'Hoja',
        last_fed: null,
        month: {},
        plan: [
          { kind: 'supplement', name: 'Calcio', every_days: 7, last_done: null, next_due: '2026-10-10', days_overdue: 2 },
          { kind: 'food', name: 'Zarzamora', every_days: 2, last_done: null, next_due: '2026-10-20', days_overdue: -8 },
        ],
      },
    ];
    const cepa = { id: 55, code: 'AN-55', stock: 10, morphs: [] };
    server.use(
      http.get(`${API}/species`, () => HttpResponse.json(page([SPECIES]))),
      http.get(`${API}/morphs`, () => HttpResponse.json(page([]))),
      http.get(`${API}/husbandry-logs`, () => HttpResponse.json(page([]))),
      http.get(`${API}/husbandry-logs/status`, () => HttpResponse.json(status)),
      http.get(`${API}/animals`, () => HttpResponse.json(page([cepa]))),
      http.post(`${API}/husbandry-logs`, async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json({ id: 2, ...saved }, { status: 201 });
      })
    );
    renderView();

    // solo lo que toca (o está atrasado); lo de dentro de 8 días no aparece
    expect(await screen.findByText('Atrasado 2 d')).toBeInTheDocument();
    expect(screen.queryByText(/Zarzamora/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Con detalles' }));
    expect(await screen.findByDisplayValue('Calcio')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Bajas'), { target: { value: '2' } });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /descontar del inventario/i }));
    fireEvent.click(await screen.findByText(/AN-55/));
    fireEvent.click(screen.getByRole('button', { name: /guardar entrada/i }));

    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved).toMatchObject({ species_id: 7, supplement: 'Calcio', fed: false, deaths: 2, animal_id: 55 });
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
        plan: [{ kind: 'food', name: 'Zarzamora', every_days: 2, last_done: null, next_due: '2026-10-10', days_overdue: 0 }],
      },
    ];
    server.use(
      http.get(`${API}/species`, () => HttpResponse.json(page([SPECIES]))),
      http.get(`${API}/morphs`, () => HttpResponse.json(page([]))),
      http.get(`${API}/husbandry-logs`, () => HttpResponse.json(page([]))),
      http.get(`${API}/husbandry-logs/status`, () => HttpResponse.json(status)),
      http.get(`${API}/animals`, () => HttpResponse.json(page([]))),
      http.post(`${API}/husbandry-logs`, async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json({ id: 3, ...saved }, { status: 201 });
      })
    );
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: 'Hecho' }));

    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved).toMatchObject({ species_id: 7, fed: true, food_type: 'Zarzamora', supplement: null });
  });
});
