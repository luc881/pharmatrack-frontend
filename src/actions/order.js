import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher, endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------
// Pedidos que entran desde el sitio público. Un pedido NO es una venta:
// cuando lo confirmas, la venta se registra en el POS como siempre.
// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetOrders({ page = 1, pageSize = 100, status } = {}) {
  const params = new URLSearchParams({ page, page_size: pageSize });
  if (status) params.set('order_status', status);

  const { data, isLoading, error, mutate } = useSWR(
    `${endpoints.order.list}?${params}`,
    fetcher,
    swrOptions
  );

  return useMemo(
    () => ({
      orders: data?.data ?? [],
      ordersTotal: data?.total ?? 0,
      ordersLoading: isLoading,
      ordersError: error,
      ordersMutate: mutate,
    }),
    [data, isLoading, error, mutate]
  );
}

export const updateOrderStatus = (id, status) =>
  axiosInstance.put(endpoints.order.update(id), { status }).then((r) => r.data);
