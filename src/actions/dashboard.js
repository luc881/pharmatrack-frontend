import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------

const SWR_OPTIONS = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// ----------------------------------------------------------------------

export function useGetDashboardStats() {
  const { data, isLoading, error } = useSWR(endpoints.stats.dashboard, fetcher, SWR_OPTIONS);

  return useMemo(
    () => ({ stats: data ?? null, statsLoading: isLoading, statsError: error }),
    [data, error, isLoading]
  );
}

// ----------------------------------------------------------------------

export function useDashboardData() {
  const { data, isLoading } = useSWR(endpoints.dashboard.stats, fetcher, SWR_OPTIONS);

  return useMemo(
    () => ({
      isLoading,
      monthlySalesCount:    data?.monthly_sales_count    ?? 0,
      monthlyRevenue:       data?.monthly_revenue        ?? 0,
      totalProducts:        data?.total_products         ?? 0,
      expiringBatchesCount: data?.expiring_batches_count ?? 0,
      expiredBatchesCount:  data?.expired_batches_count  ?? 0,
      recentSales:          data?.recent_sales           ?? [],
      expiringBatches:      data?.expiring_batches       ?? [],
    }),
    [data, isLoading]
  );
}
