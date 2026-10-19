import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/lib/axios';

import { useAllProducts } from '../product-batch/use-all-products';

// ----------------------------------------------------------------------
// Ticket de venta (diseño en Opuntia_Den_Marca/8_Ticket). Una sola forma de
// datos para el ticket impreso (sale-ticket.jsx) y el de WhatsApp/correo.
// ----------------------------------------------------------------------

const PAYMENT_LABELS = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
export const money = (n) => mxn.format(Number(n ?? 0));

const dateFmt = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
// El API manda fechas UTC sin 'Z'; sin ella el navegador las leería como hora local
export const fmtTicketDate = (iso) =>
  dateFmt.format(new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)).replace(',', '');

export const folio = (id) => `OD-${String(id).padStart(6, '0')}`;

export const TICKET_URL = 'https://opuntiaden.com/gracias';

// Plantilla compartida (Ventas > Plantilla del ticket): nombre y despedida del WhatsApp
export function useTicketTemplate() {
  const { data } = useSWR('/api/v1/settings/email-ticket', fetcher, swrOptions);
  return data;
}

// 'Gardabagusi "Argopuro"' → "Phyllium gardabagusi" + "Argopuro" (igual que care_sheets/orm.py)
function speciesNames(species) {
  const epithet = species.name
    .trim()
    .split(/[\s"“]/)[0]
    .toLowerCase();
  const locality = species.name.match(/["“]([^"”]+)["”]/)?.[1];
  return { name: `${species.genus?.name ?? ''} ${epithet}`.trim(), locality };
}

function toItem(detail, product, animal) {
  const base = {
    cantidad: Number(detail.quantity) || 0,
    precio_unitario: Number(detail.price_unit ?? 0),
  };
  if (!animal?.species) {
    return {
      ...base,
      nombre: product?.title ?? `Producto #${detail.product_id}`,
      es_cientifico: false,
      detalle: detail.description || undefined,
    };
  }
  const { species, morphs = [] } = animal;
  const { name, locality } = speciesNames(species);
  const detalle = [
    locality && `“${locality}”`,
    ...morphs.map((m) => m.name),
    species.sale_format === 'package' && species.package_size && `${species.package_size} pzas`,
    detail.description,
  ]
    .filter(Boolean)
    .join(' · ');
  return { ...base, nombre: name, es_cientifico: true, detalle: detalle || undefined };
}

// Siempre del servidor: el resto del dashboard no invalida el caché al editar
// una venta, y el ticket se imprime en cuanto hay datos.
const fresh = { ...swrOptions, revalidateOnMount: true, dedupingInterval: 0 };
function useFresh(key) {
  const { data, isValidating } = useSWR(key, fetcher, fresh);
  return isValidating ? undefined : data;
}

const listOf = (res) => (Array.isArray(res) ? res : res?.data);

// Los totales salen de la venta guardada (recalc_sale_totals en el API): el
// subtotal del servidor ya trae restados los descuentos de cada línea.
export function useSaleTicket(saleId) {
  const sale = useFresh(saleId ? endpoints.sale.details(saleId) : null);
  const saleDetails = listOf(
    useFresh(
      saleId ? [endpoints.saleDetail.list, { params: { sale_id: saleId, page_size: 100 } }] : null
    )
  );
  const salePayments = listOf(
    useFresh(saleId ? [endpoints.salePayment.list, { params: { sale_id: saleId } }] : null)
  );
  const products = useAllProducts();
  // ponytail: 500 ejemplares de golpe (tope del API); filtrar por product_id si el criadero crece
  const { data: animalsRes, isLoading: animalsLoading } = useSWR(
    saleId ? [endpoints.animal.list, { params: { page: 1, page_size: 500 } }] : null,
    fetcher,
    swrOptions
  );

  return useMemo(() => {
    if (!sale || !saleDetails || !salePayments || animalsLoading || !products.length) return null;

    const productById = new Map(products.map((p) => [p.id, p]));
    const animalByProduct = new Map((animalsRes?.data ?? []).map((a) => [a.product_id, a]));
    const details = [...saleDetails].sort((a, b) => a.id - b.id);

    const items = details.map((d) =>
      toItem(d, productById.get(d.product_id), animalByProduct.get(d.product_id))
    );
    const methods = [
      ...new Set(salePayments.map((p) => PAYMENT_LABELS[p.method_payment] ?? p.method_payment)),
    ];
    const pagado = salePayments.reduce((acc, p) => acc + Number(p.amount ?? 0), 0);

    return {
      folio: folio(sale.id),
      fecha: sale.date_sale ?? sale.created_at,
      items,
      descuento: details.reduce((acc, d) => acc + Number(d.discount ?? 0), 0) || undefined,
      impuestos: Number(sale.tax) || undefined,
      total: Number(sale.total),
      metodo_pago: methods.join(' + ') || undefined,
      pagado: pagado || undefined,
    };
  }, [sale, saleDetails, salePayments, products, animalsRes, animalsLoading]);
}

// Botón «Imprimir prueba»: el ticket de ejemplo del paquete de marca
export const SAMPLE_TICKET = {
  folio: 'OD-000123',
  fecha: new Date().toISOString(),
  cliente: 'Cliente de prueba',
  entrega: { metodo: 'A convenir', fecha: '25/10/2026' },
  items: [
    {
      cantidad: 3,
      nombre: 'Phyllium gardabagusi',
      es_cientifico: true,
      detalle: '“Argopuro” · ninfas L2',
      precio_unitario: 450,
    },
    {
      cantidad: 1,
      nombre: 'Isópodos',
      es_cientifico: false,
      detalle: 'Cultivo · 6 pzas',
      precio_unitario: 1250,
    },
  ],
  envio: 150,
  descuento: 100,
  total: 2650,
  metodo_pago: 'Transferencia',
  pagado: 2650,
  sample: true,
};

export const ticketSubtotal = (t) =>
  t.items.reduce((acc, it) => acc + it.cantidad * it.precio_unitario, 0);

// Ticket en texto plano para compartir por WhatsApp o correo
export function buildTicketText(t, { business, footer } = {}) {
  const lines = [
    `*${business || 'OPUNTIA DEN'}*`,
    `Folio ${t.folio}`,
    fmtTicketDate(t.fecha),
    '--------------------',
    ...t.items.flatMap((it) => [
      `${it.cantidad} x ${it.nombre} — ${money(it.cantidad * it.precio_unitario)}`,
      ...(it.detalle ? [`   ${it.detalle}`] : []),
    ]),
    '--------------------',
    ...(t.descuento ? [`Descuento: −${money(t.descuento)}`] : []),
    `*TOTAL: ${money(t.total)} MXN*`,
    ...(t.metodo_pago ? [`Pago: ${t.metodo_pago}`] : []),
    '',
    footer || 'Gracias por tu compra',
    TICKET_URL,
  ];
  return lines.join('\n');
}

// wa.me sin número abre el selector de contactos del vendedor
export const ticketWhatsAppUrl = (ticket) =>
  `https://wa.me/?text=${encodeURIComponent(ticket.replace(/—/g, '-'))}`;
