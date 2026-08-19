import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher } from 'src/lib/axios';

// ----------------------------------------------------------------------
// Ajustes del sitio publico. Es un solo blob JSON (app_settings key="site"):
// switches de la home mas los nueve slots de media.
// ----------------------------------------------------------------------

const SITE_URL = '/api/v1/settings/site';

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetSiteSettings() {
  const { data, isLoading, error, mutate } = useSWR(SITE_URL, fetcher, swrOptions);
  return useMemo(
    () => ({ site: data ?? null, siteLoading: isLoading, siteError: error, siteMutate: mutate }),
    [data, isLoading, error, mutate]
  );
}

// El PUT es parcial: manda solo los slots que cambian y el backend los mezcla.
export async function updateSiteMedia(patch) {
  const res = await axiosInstance.put(SITE_URL, { media: patch });
  return res.data;
}
