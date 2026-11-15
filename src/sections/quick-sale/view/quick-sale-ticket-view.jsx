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

  const hasOrder = prepLines(sale).length > 0;
  const hideTicket = onlyOrder && hasOrder;

  return (
    <TicketPrintPage
      hideTicket={hideTicket}
      extra={hasOrder ? <PrepOrder sale={sale} width={width} after={!hideTicket} /> : null}
      ticket={ticket}
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
