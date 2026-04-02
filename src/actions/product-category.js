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

export function useGetAllProductCategories() {
  const url = [endpoints.productCategory.list, { params: { page: 1, page_size: 500 } }];
  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      categories: data?.data ?? [],
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
