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

/**
 * Trae TODOS los registros de un endpoint paginado.
 * Hace una primera petición para saber el total real,
 * luego trae las páginas restantes en paralelo.
 */
const PAGE_SIZE = 100;

async function fetchAllPages(url) {
  const first = await axiosInstance
    .get(url, { params: { page: 1, page_size: PAGE_SIZE } })
    .then((r) => r.data);

  const items = first.data;
  if (first.total <= PAGE_SIZE) return items;

  const remaining = Math.ceil(first.total / PAGE_SIZE) - 1;
  const pages = await Promise.all(
    Array.from({ length: remaining }, (_, i) =>
      axiosInstance
        .get(url, { params: { page: i + 2, page_size: PAGE_SIZE } })
        .then((r) => r.data.data)
    )
  );

  return [...items, ...pages.flat()];
}

// ----------------------------------------------------------------------

export function useGetProducts({ page = 1, pageSize = 10 } = {}) {
  const url = [endpoints.product.list, { params: { page, page_size: pageSize } }];

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
  const { data, isLoading } = useSWR(
    endpoints.productCategories.list,
    fetchAllPages,
    swrOptions
  );

  return useMemo(
    () => ({ categories: data || [], categoriesLoading: isLoading }),
    [data, isLoading]
  );
}

// ----------------------------------------------------------------------

export function useGetProductBrands() {
  const { data, isLoading } = useSWR(
    endpoints.productBrands.list,
    fetchAllPages,
    swrOptions
  );

  return useMemo(
    () => ({ brands: data || [], brandsLoading: isLoading }),
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
