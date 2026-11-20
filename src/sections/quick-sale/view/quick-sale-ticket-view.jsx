import { useState, useEffect } from 'react';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { PAYMENT_LABELS } from 'src/sections/sale/print-ticket';
import {
  TicketPrintPage,
  TicketPrintControls,
  useTicketPrintSettings,
} from 'src/sections/sale/view/sale-ticket-view';

import { getKV, setKV, listSales } from '../quick-sale-store';
import { PrepOrder, prepLines, SAMPLE_ORDER } from '../prep-order';

// ----------------------------------------------------------------------

const DEFAULTS = { width: 80, offset: 0, inset: 0 };

// Encabezado del ticket de un proveedor, con lo que tenga en su ficha (Proveedores)
const supplierBusiness = (s) => ({
  business_name: s?.name ?? 'Proveedor',
  ticket_logo_url: s?.logo || null,
  ticket_qr_url: s?.ticket_qr_url || null,
  lines: (s?.ticket_lines ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean),
  logo_tall: true,
});

// «Imprimir prueba» de la venta rápida: tu ticket, uno por cada proveedor
// guardado en el equipo (con su logo y sus datos) y el talón de orden, con
// datos de ejemplo. Es lo mismo que saldrá en la convención, sin internet.
const sampleTicket = (folio, items) => {
  const total = items.reduce((sum, it) => sum + it.cantidad * it.precio_unitario, 0);
  return {
    folio,
    fecha: new Date().toISOString(),
    items,
    total,
    metodo_pago: 'Efectivo',
    pagado: total,
    sample: true,
  };
};

const sampleTickets = (context) => [
  {
    ticket: sampleTicket('VR-PRUEBA-0001', [
      {
        cantidad: 1,
        nombre: 'Cubaris murina',
        es_cientifico: true,
        detalle: 'Glacier',
        precio_unitario: 350,
      },
      { cantidad: 2, nombre: 'Cueva de resina', es_cientifico: false, precio_unitario: 80 },
    ]),
    business: context.business ?? {},
  },
  ...(context.suppliers ?? []).map((s) => ({
    ticket: sampleTicket(`${s.ticket_prefix || `P${s.id}`}-PRUEBA-0001`, [
      { cantidad: 2, nombre: 'Slushie mango', es_cientifico: false, precio_unitario: 50 },
    ]),
    business: supplierBusiness(s),
  })),
];

// Ticket de una venta rápida, armado solo con lo guardado en el dispositivo
// (la venta de la cola y los datos del negocio): se imprime igual sin internet.
// El rollo, el ajuste y el ancho se calibran en «Imprimir prueba» (aquí o en
// Ventas): se guardan en la cuenta y en la copia del equipo.
export function QuickSaleTicketView({ saleKey }) {
  const router = useRouter();
  const params = useSearchParams();
  const autoPrint = params.get('print') === '1';
  // ?only=order: se cobró con «Imprimir ticket» apagado y solo sale la orden
  const onlyOrder = params.get('only') === 'order';
  const [data, setData] = useState(); // undefined = leyendo; null = no está
  // La de la cuenta, para la prueba; sin internet, la copia del equipo
  const [live, saveLive] = useTicketPrintSettings({
    fallback: data?.context?.ticketSettings ?? DEFAULTS,
    enabled: saleKey === 'prueba',
  });

  // Abrir la prueba con internet trae al equipo lo calibrado en la cuenta
  // (p. ej. el rollo cambiado en Ventas) sin tener que «Preparar» de nuevo
  useEffect(() => {
    if (!data?.sample || !live?.saved) return;
    const { width, offset, inset = 0 } = live;
    const copy = data.context.ticketSettings;
    if (copy && copy.width === width && copy.offset === offset && (copy.inset ?? 0) === inset)
      return;
    const nextContext = { ...data.context, ticketSettings: { width, offset, inset } };
    setData((prev) => ({ ...prev, context: nextContext }));
    setKV('context', nextContext);
  }, [data, live]);

  useEffect(() => {
    let alive = true;
    Promise.all([listSales(), getKV('context')]).then(([sales, context]) => {
      if (!alive) return;
      if (saleKey === 'prueba') {
        setData({ sample: true, context: context ?? {} });
        return;
      }
      const sale = sales.find((s) => s.idempotency_key === saleKey);
      setData(sale ? { sale, context: context ?? {} } : null);
    });
    return () => {
      alive = false;
    };
  }, [saleKey]);

  // Viniendo del cobro (?print=1), al cerrar la impresión se vuelve solo a vender
  useEffect(() => {
    if (!autoPrint) return undefined;
    const back = () => router.replace(paths.dashboard.quickSale.root);
    window.addEventListener('afterprint', back);
    return () => window.removeEventListener('afterprint', back);
  }, [autoPrint, router]);

  const nextSale = (
    <Button component={RouterLink} href={paths.dashboard.quickSale.root} variant="outlined">
      Siguiente venta
    </Button>
  );

  if (data === null) {
    return (
      <Stack spacing={2} sx={{ p: 6, alignItems: 'center', textAlign: 'center' }}>
        <Typography variant="h6">Esta venta no está en este dispositivo</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Si ya se subió, búscala en Ventas para imprimir su ticket.
        </Typography>
        {nextSale}
      </Stack>
    );
  }

  const { sale, context } = data ?? {};
  const saved = context?.ticketSettings ?? DEFAULTS;
  const { width, offset, inset = 0 } = data?.sample ? (live ?? saved) : saved;

  // Calibrar desde la prueba: a la cuenta y a la copia del equipo (sin internet)
  const changeSettings = (next) => {
    saveLive(next);
    const nextContext = { ...context, ticketSettings: next };
    setData((prev) => ({ ...prev, context: nextContext }));
    setKV('context', nextContext);
  };

  if (data?.sample) {
    const noSuppliers = !(context.suppliers ?? []).length;
    return (
      <TicketPrintPage
        tickets={sampleTickets(context)}
        extra={<PrepOrder sale={SAMPLE_ORDER} width={width} after />}
        width={width}
        offset={offset}
        inset={inset}
        hint={
          noSuppliers ? (
            <Typography
              variant="body2"
              sx={{
                px: 2,
                pb: 2,
                textAlign: 'center',
                color: 'text.secondary',
                '@media print': { display: 'none' },
              }}
            >
              Para que salga el ticket de un proveedor, dalo de alta en Proveedores y toca «Preparar
              para vender sin internet» en la venta rápida.
            </Typography>
          ) : null
        }
        controls={
          <>
            <Button component={RouterLink} href={paths.dashboard.quickSale.root} variant="outlined">
              Volver a la venta rápida
            </Button>
            <Button variant="contained" onClick={() => window.print()}>
              Imprimir prueba
            </Button>
            <TicketPrintControls settings={{ width, offset, inset }} onChange={changeSettings} />
          </>
        }
      />
    );
  }

  const ticket = sale && {
    folio: sale.folio,
    fecha: sale.sold_at,
    items: sale.lines.map((l) => l.ticketItem),
    descuento: sale.totals.discount || undefined,
    impuestos: sale.totals.tax || undefined,
    total: sale.totals.total,
    metodo_pago: PAYMENT_LABELS[sale.payment.method_payment] ?? sale.payment.method_payment,
    pagado: sale.payment.amount,
    reparto: sale.owners,
  };

  // Con productos de un proveedor: un ticket por dueño, cada uno con su marca
  const tickets = sale?.tickets?.map((part) => ({
    ticket: {
      ...ticket,
      folio: part.folio,
      items: sale.lines
        .filter((l) => l.consignor_id === part.consignor_id)
        .map((l) => l.ticketItem),
      descuento: part.totals.discount || undefined,
      impuestos: part.totals.tax || undefined,
      total: part.totals.total,
      pagado: part.totals.total,
      reparto: undefined,
    },
    business:
      part.consignor_id === null
        ? (context?.business ?? {})
        : supplierBusiness(context?.suppliers?.find((s) => s.id === part.consignor_id)),
  }));

  const hasOrder = prepLines(sale).length > 0;
  const hideTicket = onlyOrder && hasOrder;

  return (
    <TicketPrintPage
      hideTicket={hideTicket}
      extra={hasOrder ? <PrepOrder sale={sale} width={width} after={!hideTicket} /> : null}
      ticket={ticket}
      tickets={tickets}
      business={context?.business ?? {}}
      width={width}
      offset={offset}
      inset={inset}
      autoPrint={autoPrint}
      controls={
        <>
          {nextSale}
          <Button variant="contained" disabled={!ticket} onClick={() => window.print()}>
            Imprimir ticket
          </Button>
        </>
      }
    />
  );
}
