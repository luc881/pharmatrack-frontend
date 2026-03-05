import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher, endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

const PAGE_SIZE = 100;

// ----------------------------------------------------------------------

async function fetchAllBrands() {
  const first = await axiosInstance
    .get(endpoints.productBrand.list, { params: { page: 1, page_size: PAGE_SIZE } })
    .then((r) => r.data);
  let items = first.data;
  if (first.total > PAGE_SIZE) {
    const remaining = Math.ceil(first.total / PAGE_SIZE) - 1;
    const pages = await Promise.all(
      Array.from({ length: remaining }, (_, i) =>
        axiosInstance
          .get(endpoints.productBrand.list, { params: { page: i + 2, page_size: PAGE_SIZE } })
          .then((r) => r.data.data)
      )
    );
    items = [...items, ...pages.flat()];
  }
  return items;
}

export function useGetAllProductBrands() {
  const { data, isLoading, error, mutate } = useSWR(
    'all-product-brands',
    fetchAllBrands,
    swrOptions
  );

  return useMemo(
    () => ({
      brands: data ?? [],
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
