import { SWRConfig } from 'swr';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { render, waitFor } from '@testing-library/react';
import { it, expect, describe, afterEach } from 'vitest';

import { SaleTicketView } from 'src/sections/sale/view/sale-ticket-view';

import { server } from '../mocks/server';

const URL = 'https://api.opuntiaden.com/api/v1/settings/ticket-print';

describe('ajuste de la impresora de tickets', () => {
  afterEach(() => localStorage.clear());

  it('sube a la cuenta el ajuste que estaba en el navegador', async () => {
    localStorage.setItem('ticketWidth', '58');
    localStorage.setItem('ticketOffset', '-1.2');
    let saved;
    server.use(
      http.get(URL, () => HttpResponse.json({ width: 80, offset: 0, saved: false })),
      http.put(URL, async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json({ ...saved, saved: true });
      })
    );

    const { getByText } = render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <MemoryRouter>
          <SaleTicketView />
        </MemoryRouter>
      </SWRConfig>
    );

    await waitFor(() => expect(saved).toEqual({ width: 58, offset: -1.2 }), { timeout: 3000 });
    expect(getByText(/-1\.2 mm/)).toBeInTheDocument();
  });
});
