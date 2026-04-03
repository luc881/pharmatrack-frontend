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

export function useGetUsers({ page = 1, pageSize = 10 } = {}) {
  const url = [endpoints.user.list, { params: { page, page_size: pageSize } }];

  const { data, isLoading, error, isValidating, mutate } = useSWR(url, fetcher, {
    ...swrOptions,
    keepPreviousData: true,
  });

  return useMemo(
    () => ({
      users: data?.data ?? [],
      usersTotal: data?.total ?? 0,
      usersLoading: isLoading || isValidating,
      usersError: error,
      usersMutate: mutate,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}

// ----------------------------------------------------------------------

export function useGetUser(userId) {
  const url = userId ? endpoints.user.details(userId) : null;
  const { data, isLoading, error } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({ user: data ?? null, userLoading: isLoading, userError: error }),
    [data, error, isLoading]
  );
}

// ----------------------------------------------------------------------

export const createUser = (data) =>
  axiosInstance.post(endpoints.user.create, data).then((r) => r.data);

export const updateUser = (id, data) =>
  axiosInstance.put(endpoints.user.update(id), data).then((r) => r.data);

export const deleteUser = (id) =>
  axiosInstance.delete(endpoints.user.delete(id)).then((r) => r.data);

export const changePassword = (id, data) =>
  axiosInstance.put(endpoints.user.changePassword(id), data).then((r) => r.data);
