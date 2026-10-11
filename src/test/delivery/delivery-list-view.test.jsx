import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { it, vi, expect, describe } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { waLink, DeliveryListView } from 'src/sections/delivery/view/delivery-list-view';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// Entregas: un cambio manda lo que entrego y lo que recibo; "Entregada"
// cambia el estado con la acción rápida.
// ----------------------------------------------------------------------

vi.mock('src/layouts/dashboard', () => ({ DashboardContent: ({ children }) => children }));
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: { permissions: ['sales.read', 'sales.create', 'sales.update'] } }),
}));
// Label importa el tema completo (CSS de data-grid), que vitest no carga
vi.mock('src/components/label', () => ({ Label: ({ children }) => children }));

const API = 'https://api.opuntiaden.com/api/v1';
const page = (data) => ({ data, total: data.length, page: 1, page_size: 50, total_pages: 1 });

const ymd = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const PENDING = {
  id: 9,
  kind: 'sale',
  status: 'pending',
  buyer_name: 'Ana',
  buyer_contact: '5512345678',
  scheduled_date: ymd(new Date()),
  scheduled_time: '17:30',
  place: 'Metro Tlatelolco',
  items_given: [{ description: 'Isópodos Rubber Ducky', quantity: 1, animal_id: null }],
  items_received: [],
  amount: 350,
  paid: false,
  payment_method: 'cash',
  sale_id: null,
  order_id: null,
  notes: null,
};

function renderView() {
  const Wrapper = createWrapper();
  return render(
    <ThemeProvider theme={createTheme({ cssVariables: true })}>
      <Wrapper>
        <MemoryRouter>
          <DeliveryListView />
        </MemoryRouter>
      </Wrapper>
    </ThemeProvider>
  );
}

const baseHandlers = (pending) => [
  http.get(`${API}/deliveries`, ({ request }) => {
    const status = new URL(request.url).searchParams.get('status');
    return HttpResponse.json(page(status === 'pending' ? pending : []));
  }),
  http.get(`${API}/animals`, () => HttpResponse.json(page([]))),
];

describe('DeliveryListView', () => {
  it('guarda un cambio con lo que entrego y lo que recibo', async () => {
    let saved = null;
    server.use(
      ...baseHandlers([]),
      http.post(`${API}/deliveries`, async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json({ id: 1, ...saved }, { status: 201 });
      })
    );
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: /nueva entrega/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cambio' }));
    fireEvent.change(screen.getByLabelText(/comprador/i), { target: { value: 'Luis' } });

    const whats = screen.getAllByRole('combobox', { name: 'Qué' });
    fireEvent.change(whats[0], { target: { value: 'Colémbolos' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar lo que recibo/i }));
    const received = screen.getAllByRole('textbox', { name: 'Qué' });
    fireEvent.change(received[received.length - 1], { target: { value: 'Hojas de roble' } });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved).toMatchObject({
      kind: 'trade',
      status: 'pending',
      buyer_name: 'Luis',
      items_given: [{ description: 'Colémbolos', quantity: 1, animal_id: null }],
      items_received: [{ description: 'Hojas de roble', quantity: 1 }],
      amount: null,
      paid: false,
      sale_id: null,
    });
  });

  it('«Entregada» cambia el estado de la pendiente', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false); // todavía no paga
    let body = null;
    server.use(
      ...baseHandlers([PENDING]),
      http.put(`${API}/deliveries/9/status`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...PENDING, ...body });
      })
    );
    renderView();

    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Hoy')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^entregada$/i }));

    await waitFor(() => expect(body).toEqual({ status: 'delivered' }));
  });

  it('«Entregada» sin pagar pregunta y, si ya pagó, guarda entregada y pagada juntas', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    let body = null;
    server.use(
      ...baseHandlers([PENDING]),
      http.put(`${API}/deliveries/9`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...PENDING, ...body });
      })
    );
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: /^entregada$/i }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ status: 'delivered', paid: true, buyer_name: 'Ana', amount: 350 });
    expect(body).not.toHaveProperty('id');
  });

  it('arma el enlace de WhatsApp solo con números de 10 dígitos', () => {
    expect(waLink('55 1234 5678')).toBe('https://wa.me/525512345678');
    expect(waLink('+52 55 1234 5678')).toBe('https://wa.me/525512345678');
    expect(waLink('@isopodos.mx')).toBeNull();
  });
});
