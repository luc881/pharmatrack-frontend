import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher, endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// ----------------------------------------------------------------------

export function useGetRefundProducts() {
  const { data, isLoading, error, mutate } = useSWR(
    endpoints.refundProduct.list,
    fetcher,
    swrOptions
  );

  return useMemo(
    () => ({
      refunds: Array.isArray(data) ? data : (data?.data ?? []),
      refundsLoading: isLoading,
      refundsError: error,
      refundsMutate: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

// ----------------------------------------------------------------------

export const createRefundProduct = (data) =>
  axiosInstance.post(endpoints.refundProduct.create, data).then((r) => r.data);

export const deleteRefundProduct = (id) =>
  axiosInstance.delete(endpoints.refundProduct.delete(id)).then((r) => r.data);
