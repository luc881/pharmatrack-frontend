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

export function useGetRoles() {
  const url = [endpoints.role.list, { params: { page: 1, page_size: 100 } }];
  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      roles: data?.data ?? [],
      rolesTotal: data?.total ?? 0,
      rolesLoading: isLoading,
      rolesError: error,
      rolesMutate: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

// ----------------------------------------------------------------------

export function useGetRole(roleId) {
  const url = roleId ? endpoints.role.details(roleId) : null;
  const { data, isLoading, error } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({ role: data ?? null, roleLoading: isLoading, roleError: error }),
    [data, error, isLoading]
  );
}

// ----------------------------------------------------------------------

export function useGetPermissions() {
  const { data, isLoading } = useSWR(endpoints.permission.all, fetcher, swrOptions);

  return useMemo(
    () => ({
      permissions: Array.isArray(data) ? data : (data?.data ?? []),
      permissionsLoading: isLoading,
    }),
    [data, isLoading]
  );
}

// ----------------------------------------------------------------------

export const createRole = (data) =>
  axiosInstance.post(endpoints.role.create, data).then((r) => r.data);

export const updateRole = (id, data) =>
  axiosInstance.put(endpoints.role.update(id), data).then((r) => r.data);

export const deleteRole = (id) =>
  axiosInstance.delete(endpoints.role.delete(id)).then((r) => r.data);
