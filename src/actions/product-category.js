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

async function fetchAllCategories() {
  const first = await axiosInstance
    .get(endpoints.productCategory.list, { params: { page: 1, page_size: PAGE_SIZE } })
    .then((r) => r.data);
  let items = first.data;
  if (first.total > PAGE_SIZE) {
    const remaining = Math.ceil(first.total / PAGE_SIZE) - 1;
    const pages = await Promise.all(
      Array.from({ length: remaining }, (_, i) =>
        axiosInstance
          .get(endpoints.productCategory.list, { params: { page: i + 2, page_size: PAGE_SIZE } })
          .then((r) => r.data.data)
      )
    );
    items = [...items, ...pages.flat()];
  }
  return items;
}

export function useGetAllProductCategories() {
  const { data, isLoading, error, mutate } = useSWR(
    'all-product-categories',
    fetchAllCategories,
    swrOptions
  );

  return useMemo(
    () => ({
      categories: data ?? [],
      categoriesLoading: isLoading,
      categoriesError: error,
      categoriesMutate: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

// ----------------------------------------------------------------------

export function useGetProductCategory(categoryId) {
  const url = categoryId ? endpoints.productCategory.details(categoryId) : null;
  const { data, isLoading, error } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({ category: data ?? null, categoryLoading: isLoading, categoryError: error }),
    [data, error, isLoading]
  );
}

// ----------------------------------------------------------------------

export const createProductCategory = (data) =>
  axiosInstance.post(endpoints.productCategory.create, data).then((r) => r.data);

export const updateProductCategory = (id, data) =>
  axiosInstance.put(endpoints.productCategory.update(id), data).then((r) => r.data);

export const deleteProductCategory = (id) =>
  axiosInstance.delete(endpoints.productCategory.delete(id)).then((r) => r.data);
