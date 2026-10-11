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

// Cobrado en el rango y lo que falta por cobrar
export function useDeliverySummary({ dateFrom, dateTo } = {}) {
  const params = {
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
  };
  const { data, isLoading, mutate } = useSWR(
    [endpoints.delivery.summary, { params }],
    fetcher,
    swrOptions
  );
  return useMemo(
    () => ({ summary: data ?? null, summaryLoading: isLoading, summaryMutate: mutate }),
    [data, isLoading, mutate]
  );
}

// Campos que acepta el PUT completo (la respuesta trae además id, fechas, etc.)
const BODY_KEYS = [
  'kind',
  'status',
  'buyer_name',
  'buyer_contact',
  'scheduled_date',
  'scheduled_time',
  'place',
  'items_given',
  'items_received',
  'amount',
  'paid',
  'payment_method',
  'sale_id',
  'order_id',
  'notes',
];

const bodyOf = (d) => Object.fromEntries(BODY_KEYS.map((k) => [k, d[k] ?? null]));

// Cambiar estado; con `paid` también la marca pagada (un solo guardado).
// ponytail: el PUT completo reusa la entrega tal como llegó; si alguien la
// editó en otro lado mientras tanto, gana esta versión.
export const changeDeliveryStatus = (d, status, { paid } = {}) =>
  paid
    ? updateDelivery(d.id, {
        ...bodyOf(d),
        items_given: d.items_given ?? [],
        items_received: d.items_received ?? [],
        paid: true,
        status,
      })
    : setDeliveryStatus(d.id, status);

// Deshace changeDeliveryStatus regresando la entrega a como estaba
export const restoreDelivery = (d) =>
  updateDelivery(d.id, {
    ...bodyOf(d),
    items_given: d.items_given ?? [],
    items_received: d.items_received ?? [],
  });
