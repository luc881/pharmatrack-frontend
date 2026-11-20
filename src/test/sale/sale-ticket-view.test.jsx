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

  it('el ticket de prueba trae también un talón de orden de ejemplo', async () => {
    server.use(
      http.get(URL, () => HttpResponse.json({ width: 80, offset: 0, saved: true })),
      http.get('https://api.opuntiaden.com/api/v1/settings/email-ticket', () =>
        HttpResponse.json({ business_name: 'Opuntia Den' })
      )
    );
    const { findByTestId, getByText } = render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <MemoryRouter>
          <SaleTicketView />
        </MemoryRouter>
      </SWRConfig>
    );

    const order = await findByTestId('prep-order');
    expect(order).toHaveTextContent('ORDEN');
    expect(order).toHaveTextContent('3 × Slushie limón $100');
    expect(order).toHaveTextContent('PRUEBA');
    // y el ticket de siempre sigue ahí
    expect(getByText('Gracias por tu compra')).toBeInTheDocument();
  });

  it('en 80 mm el ticket mide 68 mm y queda centrado en los 72 imprimibles', async () => {
    server.use(
      http.get(URL, () => HttpResponse.json({ width: 80, offset: 0, inset: 0, saved: true })),
      http.get('https://api.opuntiaden.com/api/v1/settings/email-ticket', () =>
        HttpResponse.json({ business_name: 'Opuntia Den' })
      )
    );
    const { findByText, container } = render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <MemoryRouter>
          <SaleTicketView />
        </MemoryRouter>
      </SWRConfig>
    );

    await findByText('Gracias por tu compra');
    const css = [...container.querySelectorAll('style')].map((el) => el.textContent).join('');
    expect(css).toContain('.od-ticket { width: 68mm !important; }');
    expect(css).toContain('html, body { width: 72mm;');
    // 2 mm de margen de cada lado
    expect(css).toContain('translateX(2mm)');
  });

  it('«Más angosto» quita más y lo sigue centrando, con el ajuste horizontal', async () => {
    server.use(
      http.get(URL, () => HttpResponse.json({ width: 80, offset: -1, inset: 8, saved: true })),
      http.get('https://api.opuntiaden.com/api/v1/settings/email-ticket', () =>
        HttpResponse.json({ business_name: 'Opuntia Den' })
      )
    );
    const { findByText, container } = render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <MemoryRouter>
          <SaleTicketView />
        </MemoryRouter>
      </SWRConfig>
    );

    await findByText('Gracias por tu compra');
    const css = [...container.querySelectorAll('style')].map((el) => el.textContent).join('');
    expect(css).toContain('.od-ticket { width: 60mm !important; }');
    // (72 − 60) / 2 = 6 mm de cada lado, menos 1 mm del ajuste
    expect(css).toContain('translateX(5mm)');
  });
});
