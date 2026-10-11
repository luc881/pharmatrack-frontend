import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { it, vi, expect, describe } from 'vitest';
import { render, screen } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { TodayCard } from 'src/sections/overview/app/today-card';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// "Hoy" en el inicio: entregas hasta hoy y lo que toca del plan, según permisos.
// ----------------------------------------------------------------------

vi.mock('src/components/label', () => ({ Label: ({ children }) => children }));

const API = 'https://api.opuntiaden.com/api/v1';

function renderCard(permissions) {
  const Wrapper = createWrapper();
  return render(
    <ThemeProvider theme={createTheme({ cssVariables: true })}>
      <Wrapper>
        <MemoryRouter>
          <TodayCard permissions={permissions} />
        </MemoryRouter>
      </Wrapper>
    </ThemeProvider>
  );
}

describe('TodayCard', () => {
  it('pide las pendientes hasta hoy y muestra lo que toca del plan', async () => {
    let params = null;
    server.use(
      http.get(`${API}/deliveries`, ({ request }) => {
        params = Object.fromEntries(new URL(request.url).searchParams);
        return HttpResponse.json({
          data: [{ id: 1, buyer_name: 'Ana', scheduled_date: '2000-01-01', scheduled_time: '17:00', place: 'Metro Hidalgo' }],
          total: 1,
        });
      }),
      http.get(`${API}/husbandry-logs/status`, () =>
        HttpResponse.json([
          {
            species_id: 7,
            species_name: 'Phyllium gardabagusi',
            plan: [{ kind: 'supplement', name: 'Calcio', every_days: 7, days_overdue: 1 }],
          },
        ])
      )
    );
    renderCard(['sales.read', 'sales.create', 'animals.read']);

    expect(await screen.findByText(/Ana/)).toBeInTheDocument();
    expect(screen.getByText(/Atrasada/)).toBeInTheDocument();
    expect(params.status).toBe('pending');
    expect(params.date_to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await screen.findByText('Calcio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entregada' })).toBeInTheDocument();
  });

  it('sin permisos no pinta nada', () => {
    const { container } = renderCard([]);
    expect(container).toBeEmptyDOMElement();
  });
});
