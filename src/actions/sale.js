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
  const { data, isLoading } = useSWR(endpoints.branch.list, fetcher, swrOptions);

  return useMemo(
    () => ({
      branches: Array.isArray(data) ? data : [],
      branchesLoading: isLoading,
    }),
    [data, isLoading]
  );
}

// ----------------------------------------------------------------------

export function useGetSales({ page = 1, pageSize = 10, status, dateFrom, dateTo } = {}) {
  const params = { page, page_size: pageSize };
  if (status)   params.status    = status;
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo)   params.date_to   = dateTo;

  const url = [endpoints.sale.list, { params }];

  const { data, isLoading, error, isValidating, mutate } = useSWR(url, fetcher, {
    ...swrOptions,
    keepPreviousData: true,
  });

  return useMemo(
    () => ({
      sales: data?.data ?? [],
      salesTotal: data?.total ?? 0,
      salesLoading: isLoading || isValidating,
      salesError: error,
      salesMutate: mutate,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}

// ----------------------------------------------------------------------

export function useGetSale(saleId) {
  const url = saleId ? endpoints.sale.details(saleId) : null;
  const { data, isLoading, error } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({ sale: data ?? null, saleLoading: isLoading, saleError: error }),
    [data, error, isLoading]
  );
}

// ----------------------------------------------------------------------

export function useGetSaleDetails(saleId) {
  const url = saleId
    ? [endpoints.saleDetail.list, { params: { sale_id: saleId } }]
    : null;
  const { data, isLoading } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      saleDetails: Array.isArray(data) ? data : (data?.data ?? []),
      saleDetailsLoading: isLoading,
    }),
    [data, isLoading]
  );
}

// ----------------------------------------------------------------------

export function useGetSalePayments(saleId) {
  const url = saleId
    ? [endpoints.salePayment.list, { params: { sale_id: saleId } }]
    : null;
  const { data, isLoading } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      salePayments: Array.isArray(data) ? data : (data?.data ?? []),
      salePaymentsLoading: isLoading,
    }),
    [data, isLoading]
  );
}

// ----------------------------------------------------------------------

export const createSale = (data) =>
  axiosInstance.post(endpoints.sale.create, data).then((r) => r.data);

export const updateSale = (id, data) =>
  axiosInstance.put(endpoints.sale.update(id), data).then((r) => r.data);

export const deleteSale = (id) =>
  axiosInstance.delete(endpoints.sale.delete(id)).then((r) => r.data);

export const createSaleDetail = (data) =>
  axiosInstance.post(endpoints.saleDetail.create, data).then((r) => r.data);

export const deleteSaleDetail = (id) =>
  axiosInstance.delete(endpoints.saleDetail.delete(id)).then((r) => r.data);

export const createSalePayment = (data) =>
  axiosInstance.post(endpoints.salePayment.create, data).then((r) => r.data);

export const deleteSalePayment = (id) =>
  axiosInstance.delete(endpoints.salePayment.delete(id)).then((r) => r.data);

export const createSaleBatchUsage = (data) =>
  axiosInstance.post(endpoints.saleBatchUsage.create, data).then((r) => r.data);

export const deleteSaleBatchUsage = (id) =>
  axiosInstance.delete(endpoints.saleBatchUsage.delete(id)).then((r) => r.data);
