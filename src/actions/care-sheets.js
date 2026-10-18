import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher, endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetCareSheets() {
  const { data, isLoading, error, mutate } = useSWR(endpoints.careSheet.list, fetcher, swrOptions);
  return useMemo(
    () => ({
      careSheets: data ?? [],
      careSheetsLoading: isLoading,
      careSheetsError: error,
      careSheetsMutate: mutate,
    }),
    [data, isLoading, error, mutate]
  );
}

export function useGetCareSheet(id) {
  const { data, isLoading, error, mutate } = useSWR(
    id ? endpoints.careSheet.details(id) : null,
    fetcher,
    swrOptions
  );
  return useMemo(
    () => ({
      careSheet: data,
      careSheetLoading: isLoading,
      careSheetError: error,
      careSheetMutate: mutate,
    }),
    [data, isLoading, error, mutate]
  );
}

export const createCareSheet = (data) =>
  axiosInstance.post(endpoints.careSheet.list, data).then((r) => r.data);

export const updateCareSheet = (id, data) =>
  axiosInstance.put(endpoints.careSheet.details(id), data).then((r) => r.data);

export const deleteCareSheet = (id) =>
  axiosInstance.delete(endpoints.careSheet.details(id)).then((r) => r.data);
