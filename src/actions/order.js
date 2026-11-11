import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher, endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------
// Pedidos que entran desde el sitio público. Un pedido NO es una venta:
// cuando lo confirmas, la venta se registra en el POS como siempre.
// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetOrders({ page = 1, pageSize = 100, status } = {}) {
  const params = new URLSearchParams({ page, page_size: pageSize });
  if (status) params.set('order_status', status);

  const { data, isLoading, error, mutate } = useSWR(
    `${endpoints.order.list}?${params}`,
    fetcher,
    swrOptions
  );

  return useMemo(
    () => ({
      orders: data?.data ?? [],
      ordersTotal: data?.total ?? 0,
      ordersLoading: isLoading,
      ordersError: error,
      ordersMutate: mutate,
    }),
    [data, isLoading, error, mutate]
  );
}

export const updateOrderStatus = (id, status) =>
  axiosInstance.put(endpoints.order.update(id), { status }).then((r) => r.data);

// Una cuenta bloqueada puede entrar y ver sus pedidos, pero no hacer nuevos
export const setCustomerBlocked = (customerId, blocked) =>
  axiosInstance.put(endpoints.order.blockCustomer(customerId), { blocked }).then((r) => r.data);

// Guía de envío (Envia.com): cotizar con todas las paqueterías y generar la guía
export const quoteOrderShipping = (id, data) =>
  axiosInstance.post(endpoints.order.shippingRates(id), data).then((r) => r.data);

export const createOrderShippingLabel = (id, data) =>
  axiosInstance.post(endpoints.order.shippingLabel(id), data).then((r) => r.data);

// Envíos sueltos: guías sin pedido del sitio (una venta por WhatsApp, un regalo)
export function useGetShipments() {
  const { data, isLoading, mutate } = useSWR(
    `${endpoints.shipment.list}?page_size=100`,
    fetcher,
    swrOptions
  );

  return useMemo(
    () => ({ shipments: data?.data ?? [], shipmentsLoading: isLoading, shipmentsMutate: mutate }),
    [data, isLoading, mutate]
  );
}

export const quoteShipment = (data) =>
  axiosInstance.post(endpoints.shipment.rates, data).then((r) => r.data);

export const createShipment = (data) =>
  axiosInstance.post(endpoints.shipment.list, data).then((r) => r.data);
