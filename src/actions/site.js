import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher } from 'src/lib/axios';

// ----------------------------------------------------------------------
// Ajustes del sitio publico. Es un solo blob JSON (app_settings key="site"):
// switches de la home, los nueve slots de media y la cinta de novedades.
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

// Cinta de novedades del sitio: lista completa de frases (vacía = sin cinta)
export async function updateSiteTicker(ticker) {
  const res = await axiosInstance.put(SITE_URL, { ticker });
  return res.data;
}

// ----------------------------------------------------------------------
// Contenido de /links (bio de Instagram, QR del ticket): eventos, guías,
// textos y botones. Se guarda completo.

const LINK_PAGES_URL = '/api/v1/settings/link-pages';

export function useGetLinkPages() {
  const { data, isLoading, error, mutate } = useSWR(LINK_PAGES_URL, fetcher, swrOptions);
  return useMemo(
    () => ({ linkPages: data ?? null, linkPagesLoading: isLoading, linkPagesError: error, linkPagesMutate: mutate }),
    [data, isLoading, error, mutate]
  );
}

export async function updateLinkPages(body) {
  const res = await axiosInstance.put(LINK_PAGES_URL, body);
  return res.data;
}
