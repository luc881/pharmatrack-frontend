import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher, endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetDeliveries({ status, dateFrom, dateTo, q, page = 1, pageSize = 50 } = {}) {
  const params = {
    page,
    page_size: pageSize,
    ...(status ? { status } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
    ...(q ? { q } : {}),
  };
  const { data, isLoading, mutate } = useSWR(
    [endpoints.delivery.list, { params }],
    fetcher,
    swrOptions
  );
  return useMemo(
    () => ({
      deliveries: data?.data ?? [],
      deliveriesTotal: data?.total ?? 0,
      deliveriesLoading: isLoading,
      deliveriesMutate: mutate,
    }),
    [data, isLoading, mutate]
  );
}

export const createDelivery = (data) =>
  axiosInstance.post(endpoints.delivery.create, data).then((r) => r.data);
export const updateDelivery = (id, data) =>
  axiosInstance.put(endpoints.delivery.update(id), data).then((r) => r.data);
export const setDeliveryStatus = (id, status) =>
  axiosInstance.put(endpoints.delivery.status(id), { status }).then((r) => r.data);
export const deleteDelivery = (id) =>
  axiosInstance.delete(endpoints.delivery.delete(id)).then((r) => r.data);
