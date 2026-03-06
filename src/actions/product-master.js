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

export function useGetProductMasters({ page = 1, pageSize = 25 } = {}) {
  const url = [endpoints.productMaster.list, { params: { page, page_size: pageSize } }];

  const { data, isLoading, error, isValidating, mutate } = useSWR(url, fetcher, {
    ...swrOptions,
    keepPreviousData: true,
  });

  return useMemo(
    () => ({
      productMasters: data?.data ?? [],
      productMastersTotal: data?.total ?? 0,
      productMastersLoading: isLoading || isValidating,
      productMastersError: error,
      productMastersMutate: mutate,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}

// ----------------------------------------------------------------------

export function useGetProductMaster(id) {
  const url = id ? endpoints.productMaster.details(id) : null;
  const { data, isLoading, error } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({ productMaster: data ?? null, productMasterLoading: isLoading, productMasterError: error }),
    [data, error, isLoading]
  );
}

// ----------------------------------------------------------------------

export const createProductMaster = (data) =>
  axiosInstance.post(endpoints.productMaster.create, data).then((r) => r.data);

export const updateProductMaster = (id, data) =>
  axiosInstance.put(endpoints.productMaster.update(id), data).then((r) => r.data);

export const deleteProductMaster = (id) =>
  axiosInstance.delete(endpoints.productMaster.delete(id)).then((r) => r.data);
