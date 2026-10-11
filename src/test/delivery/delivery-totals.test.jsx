import { http, HttpResponse } from 'msw';
import { it, vi, expect, describe } from 'vitest';
import { render, screen } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { DeliveryTotals } from 'src/sections/delivery/delivery-totals';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// Totales de entregas: pide el mes actual completo y pinta cobrado / por cobrar.
// ----------------------------------------------------------------------

vi.mock('src/components/label', () => ({ Label: ({ children }) => children }));

describe('DeliveryTotals', () => {
  it('pide el rango del mes y muestra los totales', async () => {
    let params = null;
    server.use(
      http.get('https://api.opuntiaden.com/api/v1/deliveries/summary', ({ request }) => {
        params = Object.fromEntries(new URL(request.url).searchParams);
        return HttpResponse.json({
          collected: '550.00',
          cash: '200.00',
          transfer: '300.00',
          other: '50.00',
          to_collect: '120.00',
          to_collect_count: 1,
          pending_count: 3,
        });
      })
    );
    const Wrapper = createWrapper();
    render(
      <ThemeProvider theme={createTheme({ cssVariables: true })}>
        <Wrapper>
          <DeliveryTotals />
        </Wrapper>
      </ThemeProvider>
    );

    expect(await screen.findByText('1 sin pagar (cualquier fecha)')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(params.date_from).toMatch(/^\d{4}-\d{2}-01$/);
    expect(params.date_to.slice(0, 7)).toBe(params.date_from.slice(0, 7));
  });
});
