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

export function useGetSuppliers({ page = 1, pageSize = 50 } = {}) {
  const url = [endpoints.supplier.list, { params: { page, page_size: pageSize } }];

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, {
    ...swrOptions,
    keepPreviousData: true,
  });

  const memoizedValue = useMemo(
    () => ({
      suppliers: data?.data ?? [],
      suppliersTotal: data?.total ?? 0,
      suppliersLoading: isLoading,
      suppliersError: error,
    }),
    [data, error, isLoading]
  );

  return { ...memoizedValue, suppliersMutate: mutate };
}

// ----------------------------------------------------------------------

export function useGetSupplier(supplierId) {
  const url = supplierId ? endpoints.supplier.details(supplierId) : null;

  const { data, isLoading, error } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      supplier: data || null,
      supplierLoading: isLoading,
      supplierError: error,
    }),
    [data, error, isLoading]
  );
}

// ----------------------------------------------------------------------

export const createSupplier = (data) =>
  axiosInstance.post(endpoints.supplier.create, data).then((r) => r.data);

export const updateSupplier = (id, data) =>
  axiosInstance.put(endpoints.supplier.update(id), data).then((r) => r.data);

export const deleteSupplier = (id) =>
  axiosInstance.delete(endpoints.supplier.delete(id)).then((r) => r.data);
