import useSWR, { useSWRConfig } from 'swr';

import axiosInstance, { endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------

const PAGE_SIZE = 100;
const KEY = 'products:all';
const EMPTY = [];

async function loadAll() {
  const first = await axiosInstance
    .get(endpoints.product.list, { params: { page: 1, page_size: PAGE_SIZE } })
    .then((r) => r.data);
  let items = first.data;
  if (first.total > PAGE_SIZE) {
    const remaining = Math.ceil(first.total / PAGE_SIZE) - 1;
    const pages = await Promise.all(
      Array.from({ length: remaining }, (_, i) =>
        axiosInstance
          .get(endpoints.product.list, { params: { page: i + 2, page_size: PAGE_SIZE } })
          .then((r) => r.data.data)
      )
    );
    items = [...items, ...pages.flat()];
  }
  return items;
}

// Se carga una vez por sesión y la comparten todos los selectores de producto
export function useAllProducts() {
  const { data } = useSWR(KEY, loadAll, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  return data ?? EMPTY;
}

// Un producto creado desde «+ Producto nuevo» aparece en todos los selectores sin recargar
export function useAddToAllProducts() {
  const { mutate } = useSWRConfig();
  return (product) => mutate(KEY, (list = []) => [...list, product], { revalidate: false });
}
