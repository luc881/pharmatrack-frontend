import { SWRConfig } from 'swr';
import { it, vi, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import userEvent from '@testing-library/user-event';
import { render, screen, within, waitFor } from '@testing-library/react';

import { SaleListView } from 'src/sections/sale/view/sale-list-view';

import { server } from '../mocks/server';

vi.mock('src/layouts/dashboard', () => ({ DashboardContent: ({ children }) => children }));
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({
    user: { id: 1, role: 'admin', permissions: ['sales.create', 'sales.update', 'sales.delete'] },
  }),
}));

// DataGrid y Label importan CSS que vitest no carga: tabla mínima con las
// mismas columnas, y las acciones del menú como botones
vi.mock('@mui/material/styles', async (original) => ({
  ...(await original()),
  useTheme: () => ({ vars: { palette: { error: { main: 'red' } } } }),
}));
vi.mock('src/components/custom-breadcrumbs', () => ({ CustomBreadcrumbs: () => null }));
vi.mock('src/components/label', () => ({ Label: ({ children }) => children }));
vi.mock('src/sections/sale/sale-pdf', () => ({ SalePDFRowButton: () => null }));
vi.mock('@mui/x-data-grid', () => ({
  gridClasses: { cell: 'cell' },
  Toolbar: () => null,
  DataGrid: ({ rows, columns }) => (
    <table>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {columns.map((c) => (
              <td key={c.field}>
                {c.getActions?.({ row, id: row.id }) ??
                  c.renderCell?.({ row }) ??
                  c.valueGetter?.(row[c.field], row) ??
                  row[c.field]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));
vi.mock('src/components/custom-data-grid', () => ({
  useToolbarSettings: () => ({ settings: {} }),
  ToolbarContainer: () => null,
  ToolbarLeftPanel: () => null,
  ToolbarRightPanel: () => null,
  CustomToolbarQuickFilter: () => null,
  CustomToolbarExportButton: () => null,
  CustomToolbarColumnsButton: () => null,
  CustomToolbarSettingsButton: () => null,
  CustomGridActionsCellItem: ({ label, onClick }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
}));

const API = 'https://api.opuntiaden.com/api/v1';

it('«Cancelar venta» pide confirmación y la deja cancelada (no la borra)', async () => {
  let sale = {
    id: 68,
    date_sale: '2026-11-21T10:00:00',
    total: '170.00',
    subtotal: '170.00',
    discount: '0',
    status: 'completed',
    description: 'Venta rápida · VR-CWP5-0043',
  };
  const calls = [];
  server.use(
    http.get(`${API}/sales`, () => HttpResponse.json({ data: [sale], total: 1 })),
    http.get(`${API}/products`, () => HttpResponse.json({ data: [], total: 0 })),
    http.post(`${API}/sales/68/cancel`, () => {
      calls.push('cancel');
      sale = { ...sale, status: 'cancelled' };
      return HttpResponse.json(sale);
    }),
    http.delete(`${API}/sales/68`, () => {
      calls.push('delete');
      return new HttpResponse(null, { status: 204 });
    })
  );
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  const user = userEvent.setup();
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <MemoryRouter>
        <SaleListView />
      </MemoryRouter>
    </SWRConfig>
  );

  const row = within((await screen.findByText('Venta rápida · VR-CWP5-0043')).closest('tr'));
  // una venta completada no se borra (perdería el stock): se cancela
  expect(row.queryByRole('button', { name: 'Eliminar' })).toBeNull();
  await user.click(row.getByRole('button', { name: 'Cancelar venta' }));

  await waitFor(() => expect(calls).toEqual(['cancel']));
  expect(confirm).toHaveBeenCalled();
  expect(await screen.findByText('Cancelada')).toBeInTheDocument();
  confirm.mockRestore();
});
