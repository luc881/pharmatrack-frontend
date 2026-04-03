import { http, HttpResponse } from 'msw';
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useDashboardData } from 'src/actions/dashboard';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// Tests del hook de datos del dashboard
// ----------------------------------------------------------------------

describe('useDashboardData', () => {
  it('retorna los datos del dashboard cuando la API responde correctamente', async () => {
    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    // Inicialmente está cargando
    expect(result.current.isLoading).toBe(true);

    // Esperamos a que terminen de cargar
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.monthlySalesCount).toBe(42);
    expect(result.current.monthlyRevenue).toBe(15800.5);
    expect(result.current.totalProducts).toBe(120);
    expect(result.current.expiringBatchesCount).toBe(5);
    expect(result.current.expiredBatchesCount).toBe(2);
  });

  it('retorna valores por defecto cuando la API falla', async () => {
    server.use(
      http.get('https://api.farmaciaselene.com/api/v1/dashboard/stats', () =>
        HttpResponse.json({ detail: 'Error interno' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // En caso de error deben volver los defaults (0 y [])
    expect(result.current.monthlySalesCount).toBe(0);
    expect(result.current.monthlyRevenue).toBe(0);
    expect(result.current.recentSales).toEqual([]);
    expect(result.current.expiringBatches).toEqual([]);
  });
});
