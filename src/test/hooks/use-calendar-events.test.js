import { http, HttpResponse } from 'msw';
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useGetBatchCalendarEvents } from 'src/actions/calendar';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// Tests del hook de eventos del calendario
// ----------------------------------------------------------------------

describe('useGetBatchCalendarEvents', () => {
  it('retorna los eventos cuando la API responde correctamente', async () => {
    const { result } = renderHook(() => useGetBatchCalendarEvents(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.eventsLoading).toBe(false));

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].title).toBe('Paracetamol Lote A');
    expect(result.current.events[0].color).toBe('#FFAB00');
  });

  it('retorna un array vacío si la API responde con datos inválidos', async () => {
    server.use(
      http.get('https://api.farmaciaselene.com/api/v1/calendar/events', () =>
        HttpResponse.json(null)
      )
    );

    const { result } = renderHook(() => useGetBatchCalendarEvents(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.eventsLoading).toBe(false));

    expect(result.current.events).toEqual([]);
  });
});
