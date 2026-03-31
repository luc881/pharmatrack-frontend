import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------

export function useGetDashboardStats() {
  const { data, isLoading, error } = useSWR(endpoints.stats.dashboard, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  return useMemo(
    () => ({
      stats: data ?? null,
      statsLoading: isLoading,
      statsError: error,
    }),
    [data, isLoading, error]
  );
}

// ----------------------------------------------------------------------

const SWR_OPTIONS = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// ----------------------------------------------------------------------

export function useDashboardData() {
  const { data: salesData, isLoading: salesLoading } = useSWR(
    [endpoints.sale.list, { params: { page: 1, page_size: 100 } }],
    fetcher,
    SWR_OPTIONS
  );

  const { data: productsData, isLoading: productsLoading } = useSWR(
    [endpoints.product.list, { params: { page: 1, page_size: 1 } }],
    fetcher,
    SWR_OPTIONS
  );

  const { data: batchesData, isLoading: batchesLoading } = useSWR(
    [endpoints.productBatch.list, { params: { page: 1, page_size: 100 } }],
    fetcher,
    SWR_OPTIONS
  );

  return useMemo(() => {
    const sales = salesData?.data ?? [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlySales = sales.filter((s) => {
      if (!s.date_sale) return false;
      const d = new Date(s.date_sale);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const monthlyRevenue = monthlySales
      .filter((s) => s.status === 'completed')
      .reduce((sum, s) => sum + Number(s.total ?? 0), 0);

    const batches = batchesData?.data ?? [];
    const expiringBatches = batches
      .filter((b) => {
        if (!b.expiration_date) return false;
        const diffDays = Math.ceil(
          (new Date(b.expiration_date) - now) / (1000 * 60 * 60 * 24)
        );
        return diffDays >= 0 && diffDays <= 30;
      })
      .sort((a, b) => new Date(a.expiration_date) - new Date(b.expiration_date));

    return {
      isLoading: salesLoading || productsLoading || batchesLoading,
      monthlySalesCount: monthlySales.length,
      monthlyRevenue,
      totalProducts: productsData?.total ?? 0,
      expiringBatchesCount: expiringBatches.length,
      recentSales: sales.slice(0, 10),
      expiringBatches: expiringBatches.slice(0, 8),
    };
  }, [salesData, productsData, batchesData, salesLoading, productsLoading, batchesLoading]);
}
