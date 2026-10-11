import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { it, vi, expect, describe } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { HusbandryPlanCard } from 'src/sections/animal/husbandry-plan-card';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// Plan de manejo en la ficha: muestra qué toca y guarda el plan en la especie.
// ----------------------------------------------------------------------

// Label importa el tema completo (CSS de data-grid), que vitest no carga
vi.mock('src/components/label', () => ({ Label: ({ children }) => children }));

const API = 'https://api.opuntiaden.com/api/v1';
const SPECIES = {
  id: 7,
  name: 'gardabagusi',
  husbandry_plan: [{ kind: 'food', name: 'Zarzamora', every_days: 2 }],
};
const STATUS = [
  {
    species_id: 7,
    species_name: 'Phyllium gardabagusi',
    last_fed: '2026-10-08',
    month: { feedings: 4, molt: 1, eggs: 0, births: 0, deaths: 0 },
    plan: [{ kind: 'food', name: 'Zarzamora', every_days: 2, last_done: '2026-10-08', next_due: '2026-10-10', days_overdue: 0 }],
  },
];

describe('HusbandryPlanCard', () => {
  it('muestra lo que toca y guarda un suplemento nuevo', async () => {
    let saved = null;
    server.use(
      http.get(`${API}/husbandry-logs/status`, () => HttpResponse.json(STATUS)),
      http.put(`${API}/species/7`, async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json({ ...SPECIES, ...saved });
      })
    );
    const Wrapper = createWrapper();
    render(
      <ThemeProvider theme={createTheme({ cssVariables: true })}>
        <Wrapper>
          <MemoryRouter>
            <HusbandryPlanCard species={SPECIES} canEdit />
          </MemoryRouter>
        </Wrapper>
      </ThemeProvider>
    );

    expect(await screen.findByText('Toca hoy')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /editar plan/i }));
    fireEvent.click(await screen.findByRole('button', { name: /suplemento/i }));
    const names = screen.getAllByRole('combobox', { name: 'Qué' });
    fireEvent.change(names[1], { target: { value: 'Calcio' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar plan/i }));

    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved.husbandry_plan).toEqual([
      { kind: 'food', name: 'Zarzamora', every_days: 2 },
      { kind: 'supplement', name: 'Calcio', every_days: 7 },
    ]);
  });
});
