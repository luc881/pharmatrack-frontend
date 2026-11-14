import useSWR from 'swr';

import { fetcher, endpoints } from 'src/lib/axios';

import { updateProduct } from './product';

// ----------------------------------------------------------------------
// Convenciones: productos de último momento por revisar y corte por dueño
// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// Productos creados al vuelo en la venta rápida, con lo que vendieron
export function useGetProvisionals() {
  const { data, isLoading, error, mutate } = useSWR(endpoints.product.provisional, fetcher, {
    ...swrOptions,
    revalidateOnMount: true,
  });
  return {
    provisionals: data ?? [],
    provisionalsLoading: isLoading,
    provisionalsError: error,
    provisionalsMutate: mutate,
  };
}

// Pasa a ser un producto formal (falta completarle los datos)
export const keepProvisional = (id) => updateProduct(id, { provisional: false });

// Sus ventas quedan en el historial; deja de venderse
export const discardProvisional = (id) =>
  updateProduct(id, { is_active: false, quick_sale: false });

// Cuánto vendió cada dueño (propio y proveedores en consigna) en el rango
export function useOwnerCut({ from, to }) {
  const { data, isLoading } = useSWR(
    [endpoints.sale.byOwner, { params: { date_from: from, date_to: to } }],
    fetcher,
    swrOptions
  );
  return { cut: data ?? [], cutLoading: isLoading };
}
