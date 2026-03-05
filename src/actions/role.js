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

export function useGetRoles() {
  // Roles list is small — fetch all pages
  const url = [endpoints.role.list, { params: { page: 1, page_size: PAGE_SIZE } }];
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

async function fetchAllPermissions() {
  const first = await axiosInstance
    .get(endpoints.permission.list, { params: { page: 1, page_size: PAGE_SIZE } })
    .then((r) => r.data);
  let items = first.data;
  if (first.total > PAGE_SIZE) {
    const remaining = Math.ceil(first.total / PAGE_SIZE) - 1;
    const pages = await Promise.all(
      Array.from({ length: remaining }, (_, i) =>
        axiosInstance
          .get(endpoints.permission.list, { params: { page: i + 2, page_size: PAGE_SIZE } })
          .then((r) => r.data.data)
      )
    );
    items = [...items, ...pages.flat()];
  }
  return items;
}

export function useGetPermissions() {
  const { data, isLoading } = useSWR('all-permissions', fetchAllPermissions, swrOptions);

  return useMemo(
    () => ({
      permissions: data ?? [],
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
