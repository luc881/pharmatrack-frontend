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

export function useGetProductBatches({ page = 1, pageSize = 10 } = {}) {
  const url = [endpoints.productBatch.list, { params: { page, page_size: pageSize } }];

  const { data, isLoading, error, isValidating, mutate } = useSWR(url, fetcher, {
    ...swrOptions,
    keepPreviousData: true,
  });

  return useMemo(
    () => ({
      batches: data?.data ?? [],
      batchesTotal: data?.total ?? 0,
      batchesLoading: isLoading || isValidating,
      batchesError: error,
      batchesMutate: mutate,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}

// ----------------------------------------------------------------------

export function useGetProductBatch(batchId) {
  const url = batchId ? endpoints.productBatch.details(batchId) : null;
  const { data, isLoading, error } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({ batch: data ?? null, batchLoading: isLoading, batchError: error }),
    [data, error, isLoading]
  );
}

// ----------------------------------------------------------------------

export const createProductBatch = (data) =>
  axiosInstance.post(endpoints.productBatch.create, data).then((r) => r.data);

export const updateProductBatch = (id, data) =>
  axiosInstance.put(endpoints.productBatch.update(id), data).then((r) => r.data);

export const deleteProductBatch = (id) =>
  axiosInstance.delete(endpoints.productBatch.delete(id)).then((r) => r.data);
