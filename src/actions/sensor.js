import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------

// Poll every 30 seconds to keep readings fresh
const POLL_INTERVAL = 30_000;

// ----------------------------------------------------------------------

export function useGetLatestSensorReading() {
  const { data, isLoading, error } = useSWR(endpoints.sensor.latest, fetcher, {
    refreshInterval: POLL_INTERVAL,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  return useMemo(
    () => ({
      reading: data ?? null,
      readingLoading: isLoading,
      readingError: error,
    }),
    [data, error, isLoading]
  );
}

// ----------------------------------------------------------------------

export function useGetSensorHistory({ pageSize = 24 } = {}) {
  const url = [endpoints.sensor.list, { params: { page: 1, page_size: pageSize } }];

  const { data, isLoading } = useSWR(url, fetcher, {
    refreshInterval: POLL_INTERVAL,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  return useMemo(
    () => ({
      history: data?.data ?? [],
      historyLoading: isLoading,
    }),
    [data, isLoading]
  );
}
