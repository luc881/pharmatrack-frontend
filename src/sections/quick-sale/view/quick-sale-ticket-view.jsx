import { useState, useEffect } from 'react';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { PAYMENT_LABELS } from 'src/sections/sale/print-ticket';
import { TicketPrintPage } from 'src/sections/sale/view/sale-ticket-view';

import { PrepOrder, prepLines } from '../prep-order';
import { getKV, listSales } from '../quick-sale-store';

// ----------------------------------------------------------------------

const DEFAULTS = { width: 80, offset: 0 };

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

// Ticket de una venta rápida, armado solo con lo guardado en el dispositivo
// (la venta de la cola y los datos del negocio): se imprime igual sin internet.
// El rollo y el ajuste se calibran en Ventas → «Imprimir prueba».
export function QuickSaleTicketView({ saleKey }) {
  const router = useRouter();
  const params = useSearchParams();
  const autoPrint = params.get('print') === '1';
  // ?only=order: se cobró con «Imprimir ticket» apagado y solo sale la orden
  const onlyOrder = params.get('only') === 'order';
  const [data, setData] = useState(); // undefined = leyendo; null = no está

  useEffect(() => {
    let alive = true;
    Promise.all([listSales(), getKV('context')]).then(([sales, context]) => {
      if (!alive) return;
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
  const { width, offset } = context?.ticketSettings ?? DEFAULTS;

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
      items: sale.lines.filter((l) => l.consignor_id === part.consignor_id).map((l) => l.ticketItem),
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
