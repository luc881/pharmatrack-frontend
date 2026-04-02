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

export function useGetProducts({ page = 1, pageSize = 10, search = '' } = {}) {
  const params = { page, page_size: pageSize };
  // Cambia 'search' por el nombre del query param que use tu backend (ej: 'q', 'name')
  if (search) params.search = search;
  const url = [endpoints.product.list, { params }];

  const { data, isLoading, error, isValidating, mutate } = useSWR(url, fetcher, {
    ...swrOptions,
    keepPreviousData: true,
  });

  const memoizedValue = useMemo(
    () => ({
      products: data?.data || [],
      productsTotal: data?.total || 0,
      productsLoading: isLoading,
      productsError: error,
      productsValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return { ...memoizedValue, productsMutate: mutate };
}

// ----------------------------------------------------------------------

export function useGetProduct(productId) {
  const url = productId ? endpoints.product.details(productId) : null;

  const { data, isLoading, error, isValidating } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      product: data || null,
      productLoading: isLoading,
      productError: error,
      productValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );
}

// ----------------------------------------------------------------------

export function useGetProductCategories() {
  const url = [endpoints.productCategories.list, { params: { page: 1, page_size: 500 } }];
  const { data, isLoading } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({ categories: data?.data || [], categoriesLoading: isLoading }),
    [data, isLoading]
  );
}

// ----------------------------------------------------------------------

export function useGetProductBrands() {
  const url = [endpoints.productBrands.list, { params: { page: 1, page_size: 500 } }];
  const { data, isLoading } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({ brands: data?.data || [], brandsLoading: isLoading }),
    [data, isLoading]
  );
}

// ----------------------------------------------------------------------

// Stub para el buscador del shop (no usado en el dashboard)
export function useSearchProducts() {
  return { searchResults: [], searchLoading: false, searchError: null, searchEmpty: true };
}

// ----------------------------------------------------------------------

export const createProduct = (data) =>
  axiosInstance.post(endpoints.product.create, data).then((res) => res.data);

export const updateProduct = (id, data) =>
  axiosInstance.put(endpoints.product.update(id), data).then((res) => res.data);

export const deleteProduct = (id) =>
  axiosInstance.delete(endpoints.product.delete(id)).then((res) => res.data);
