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

export function useGetPurchases({ page = 1, pageSize = 10 } = {}) {
  const url = [endpoints.purchase.list, { params: { page, page_size: pageSize } }];

  const { data, isLoading, error, isValidating, mutate } = useSWR(url, fetcher, {
    ...swrOptions,
    keepPreviousData: true,
  });

  return useMemo(
    () => ({
      purchases: data?.data ?? [],
      purchasesTotal: data?.total ?? 0,
      purchasesLoading: isLoading || isValidating,
      purchasesError: error,
      purchasesMutate: mutate,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}

// ----------------------------------------------------------------------

export function useGetPurchase(purchaseId) {
  const url = purchaseId ? endpoints.purchase.details(purchaseId) : null;

  const { data, isLoading, error } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      purchase: data ?? null,
      purchaseLoading: isLoading,
      purchaseError: error,
    }),
    [data, error, isLoading]
  );
}

// ----------------------------------------------------------------------

export function useGetPurchaseDetails(purchaseId) {
  const url = purchaseId
    ? [endpoints.purchaseDetail.list, { params: { purchase_id: purchaseId } }]
    : null;

  const { data, isLoading, error } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      // The API may return paginated or plain array
      purchaseDetails: Array.isArray(data) ? data : (data?.data ?? []),
      purchaseDetailsLoading: isLoading,
      purchaseDetailsError: error,
    }),
    [data, error, isLoading]
  );
}

// ----------------------------------------------------------------------

export const createPurchase = (data) =>
  axiosInstance.post(endpoints.purchase.create, data).then((r) => r.data);

export const updatePurchase = (id, data) =>
  axiosInstance.put(endpoints.purchase.update(id), data).then((r) => r.data);

export const deletePurchase = (id) =>
  axiosInstance.delete(endpoints.purchase.delete(id)).then((r) => r.data);

export const createPurchaseDetail = (data) =>
  axiosInstance.post(endpoints.purchaseDetail.create, data).then((r) => r.data);

export const deletePurchaseDetail = (id) =>
  axiosInstance.delete(endpoints.purchaseDetail.delete(id)).then((r) => r.data);
