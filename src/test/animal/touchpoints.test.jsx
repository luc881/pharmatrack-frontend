import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { it, vi, expect, describe } from 'vitest';
import { render, screen, waitFor, fireEvent, renderHook } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { DeliveryListView } from 'src/sections/delivery/view/delivery-list-view';
import { keptUnitsBy, availableUnits } from 'src/sections/animal/view/cultivos-view';
import { scanBlockReason, useBlockedAnimalProducts } from 'src/sections/sale/sale-create-edit-form';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

vi.mock('src/layouts/dashboard', () => ({ DashboardContent: ({ children }) => children }));
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: { permissions: ['sales.read', 'sales.create', 'sales.update'] } }),
}));
vi.mock('src/components/label', () => ({ Label: ({ children }) => children }));

const API = 'https://api.opuntiaden.com/api/v1';
const page = (data) => ({ data, total: data.length, page: 1, page_size: 500, total_pages: 1 });

describe('destino en los puntos de contacto', () => {
  it('Cultivos: el bajo stock cuenta solo lo que está en venta', () => {
    const animals = [
      { status: 'available', purpose: 'growing', stock: 50 },
      { status: 'available', purpose: 'sale', stock: 1 },
    ];
    expect(availableUnits(animals)).toBe(1);
  });

  it('Cultivos: pie de cría y crianza van aparte, por especie y por morph', () => {
    const species = [{ id: 1, sale_format: 'package', package_size: 6 }];
    const animals = [
      { species_id: 1, status: 'available', purpose: 'growing', stock: 17, morphs: [{ id: 9 }] },
      { species_id: 1, status: 'available', purpose: 'breeder', stock: 4, morphs: [] },
      { species_id: 1, status: 'available', purpose: 'sale', stock: 3, morphs: [{ id: 9 }] },
    ];
    expect(keptUnitsBy(animals, species)).toEqual({ 1: { breeder: 4, growing: 17 } });
    expect(keptUnitsBy(animals, species, true)).toEqual({ 9: { breeder: 0, growing: 17 } });
  });

  it('POS: un pie de cría y uno en crianza quedan bloqueados con su etiqueta', async () => {
    server.use(
      http.get(`${API}/animals`, ({ request }) => {
        const p = new URL(request.url).searchParams;
        if (p.get('purpose') === 'breeder')
          return HttpResponse.json(page([{ id: 1, product_id: 11, purpose: 'breeder' }]));
        if (p.get('purpose') === 'growing')
          return HttpResponse.json(page([{ id: 2, product_id: 12, purpose: 'growing' }]));
        return HttpResponse.json(page([]));
      })
    );
    const { result } = renderHook(() => useBlockedAnimalProducts());
    await waitFor(() => expect(result.current.size).toBe(2));
    expect(result.current.get(11)).toBe('Pie de cría');
    expect(result.current.get(12)).toBe('En crianza');
  });

  it('POS: con una API que ignora `purpose` no bloquea lo que está en venta', async () => {
    // API vieja: devuelve todo lo disponible sin importar el filtro
    server.use(
      http.get(`${API}/animals`, ({ request }) => {
        const p = new URL(request.url).searchParams;
        if (p.get('status') !== 'available') return HttpResponse.json(page([]));
        return HttpResponse.json(
          page([
            { id: 1, product_id: 11, purpose: 'breeder' },
            { id: 3, product_id: 13, purpose: 'sale' },
            { id: 4, product_id: 14 }, // sin purpose: era de venta
          ])
        );
      })
    );
    const { result } = renderHook(() => useBlockedAnimalProducts());
    await waitFor(() => expect(result.current.size).toBe(1));
    expect(result.current.get(11)).toBe('Pie de cría');
    expect(result.current.has(13)).toBe(false);
    expect(result.current.has(14)).toBe(false);
  });

  it('Entregas pide solo animales en venta', async () => {
    const seen = [];
    server.use(
      http.get(`${API}/deliveries`, () => HttpResponse.json(page([]))),
      http.get(`${API}/animals`, ({ request }) => {
        seen.push(new URL(request.url).searchParams);
        return HttpResponse.json(page([]));
      })
    );
    const Wrapper = createWrapper();
    render(
      <ThemeProvider theme={createTheme({ cssVariables: true })}>
        <Wrapper>
          <MemoryRouter>
            <DeliveryListView />
          </MemoryRouter>
        </Wrapper>
      </ThemeProvider>
    );
    fireEvent.click(await screen.findByRole('button', { name: /nueva entrega/i }));
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(seen.every((p) => p.get('purpose') === 'sale')).toBe(true);
  });

  it('el escáner rechaza un animal que no está en venta', () => {
    const blocked = new Map([[11, 'Pie de cría']]);
    expect(scanBlockReason({ id: 11, title: 'Gecko 01' }, blocked)).toBe(
      'Gecko 01: Pie de cría — no se puede vender'
    );
    expect(scanBlockReason({ id: 12, title: 'Gecko 02' }, blocked)).toBeNull();
  });
});
