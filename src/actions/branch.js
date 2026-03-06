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

export function useGetBranches() {
  const { data, isLoading, error, mutate } = useSWR(endpoints.branch.list, fetcher, swrOptions);

  return useMemo(
    () => ({
      branches: Array.isArray(data) ? data : [],
      branchesLoading: isLoading,
      branchesError: error,
      branchesMutate: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

// ----------------------------------------------------------------------

export function useGetBranch(branchId) {
  const url = branchId ? endpoints.branch.details(branchId) : null;
  const { data, isLoading, error } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({ branch: data ?? null, branchLoading: isLoading, branchError: error }),
    [data, error, isLoading]
  );
}

// ----------------------------------------------------------------------

export const createBranch = (data) =>
  axiosInstance.post(endpoints.branch.create, data).then((r) => r.data);

export const updateBranch = (id, data) =>
  axiosInstance.put(endpoints.branch.update(id), data).then((r) => r.data);

export const deleteBranch = (id) =>
  axiosInstance.delete(endpoints.branch.delete(id)).then((r) => r.data);
