import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher, endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetArticles() {
  const { data, isLoading, error, mutate } = useSWR(endpoints.article.list, fetcher, swrOptions);
  return useMemo(
    () => ({
      articles: data ?? [],
      articlesLoading: isLoading,
      articlesError: error,
      articlesMutate: mutate,
    }),
    [data, isLoading, error, mutate]
  );
}

export function useGetArticle(id) {
  const { data, isLoading, error, mutate } = useSWR(
    id ? endpoints.article.details(id) : null,
    fetcher,
    swrOptions
  );
  return useMemo(
    () => ({ article: data, articleLoading: isLoading, articleError: error, articleMutate: mutate }),
    [data, isLoading, error, mutate]
  );
}

export const createArticle = (data) =>
  axiosInstance.post(endpoints.article.create, data).then((r) => r.data);

export const updateArticle = (id, data) =>
  axiosInstance.put(endpoints.article.update(id), data).then((r) => r.data);

export const deleteArticle = (id) =>
  axiosInstance.delete(endpoints.article.delete(id)).then((r) => r.data);
