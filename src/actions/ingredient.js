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

export function useGetIngredients({ page = 1, pageSize = 10 } = {}) {
  const url = [endpoints.ingredient.list, { params: { page, page_size: pageSize } }];

  const { data, isLoading, error, isValidating, mutate } = useSWR(url, fetcher, {
    ...swrOptions,
    keepPreviousData: true,
  });

  return useMemo(
    () => ({
      ingredients: data?.data ?? [],
      ingredientsTotal: data?.total ?? 0,
      ingredientsLoading: isLoading || isValidating,
      ingredientsError: error,
      ingredientsMutate: mutate,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}

// ----------------------------------------------------------------------

export function useGetIngredient(ingredientId) {
  const url = ingredientId ? endpoints.ingredient.details(ingredientId) : null;
  const { data, isLoading, error } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({ ingredient: data ?? null, ingredientLoading: isLoading, ingredientError: error }),
    [data, error, isLoading]
  );
}

// ----------------------------------------------------------------------

export const createIngredient = (data) =>
  axiosInstance.post(endpoints.ingredient.create, data).then((r) => r.data);

export const updateIngredient = (id, data) =>
  axiosInstance.put(endpoints.ingredient.update(id), data).then((r) => r.data);

export const deleteIngredient = (id) =>
  axiosInstance.delete(endpoints.ingredient.delete(id)).then((r) => r.data);
