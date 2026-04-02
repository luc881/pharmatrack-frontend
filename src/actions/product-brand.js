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

export function useGetAllProductBrands() {
  const url = [endpoints.productBrand.list, { params: { page: 1, page_size: 500 } }];
  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      brands: data?.data ?? [],
      brandsLoading: isLoading,
      brandsError: error,
      brandsMutate: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

// ----------------------------------------------------------------------

export function useGetProductBrand(brandId) {
  const url = brandId ? endpoints.productBrand.details(brandId) : null;
  const { data, isLoading, error } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({ brand: data ?? null, brandLoading: isLoading, brandError: error }),
    [data, error, isLoading]
  );
}

// ----------------------------------------------------------------------

export const createProductBrand = (data) =>
  axiosInstance.post(endpoints.productBrand.create, data).then((r) => r.data);

export const updateProductBrand = (id, data) =>
  axiosInstance.put(endpoints.productBrand.update(id), data).then((r) => r.data);

export const deleteProductBrand = (id) =>
  axiosInstance.delete(endpoints.productBrand.delete(id)).then((r) => r.data);
