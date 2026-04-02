import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// ----------------------------------------------------------------------

export function useGetBatchCalendarEvents() {
  const { data, isLoading } = useSWR(endpoints.calendar.events, fetcher, swrOptions);

  return useMemo(
    () => ({
      events: Array.isArray(data) ? data : [],
      eventsLoading: isLoading,
    }),
    [data, isLoading]
  );
}
