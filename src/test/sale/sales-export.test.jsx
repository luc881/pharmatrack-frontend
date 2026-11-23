import { SWRConfig } from 'swr';
import { it, vi, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, renderHook } from '@testing-library/react';

import { useGetSales } from 'src/actions/sale';

import { SalesExportButton } from 'src/sections/sale/sales-export-button';

import { server } from '../mocks/server';

const API = 'https://api.opuntiaden.com/api/v1';

it('«Descargar Excel» pide todo el periodo con los filtros puestos', async () => {
  let query;
  server.use(
    http.get(`${API}/sales/export`, ({ request }) => {
      query = Object.fromEntries(new URL(request.url).searchParams);
      return new HttpResponse('xlsx');
    })
  );
  let blob;
  URL.createObjectURL = vi.fn((b) => {
    blob = b;
    return 'blob:x';
  });
  URL.revokeObjectURL = vi.fn();
  let filename;
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function save() {
    filename = this.download;
  });

  render(
    <SalesExportButton
      filters={{ status: 'completed', dateFrom: '2026-11-20', dateTo: '2026-11-22' }}
    />
  );
  await userEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }));

  await waitFor(() => expect(filename).toBe('ventas_2026-11-20_2026-11-22.xlsx'));
  expect(query).toEqual({
    date_from: '2026-11-20',
    date_to: '2026-11-22',
    status_filter: 'completed',
  });
  expect(blob.size).toBe(4);
  click.mockRestore();
});

it('la lista filtra por estado y por días de México completos', async () => {
  let query;
  server.use(
    http.get(`${API}/sales`, ({ request }) => {
      query = Object.fromEntries(new URL(request.url).searchParams);
      return HttpResponse.json({ data: [], total: 0 });
    })
  );
  renderHook(
    () => useGetSales({ status: 'cancelled', dateFrom: '2026-11-20', dateTo: '2026-11-22' }),
    {
      wrapper: ({ children }) => (
        <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
      ),
    }
  );
  await waitFor(() =>
    expect(query).toMatchObject({
      status_filter: 'cancelled',
      date_from: '2026-11-20T06:00:00',
      date_to: '2026-11-23T05:59:59',
    })
  );
});
