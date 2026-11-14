import { toItem } from 'src/sections/sale/print-ticket';

import { cartTotals } from './quick-sale-math';

// ----------------------------------------------------------------------
// Ventas del dispositivo: se arman completas al cobrar (con lo necesario
// para imprimir el ticket y para subirlas después) y viven en la cola local
// hasta que el servidor las registra.
// ----------------------------------------------------------------------

// Renglón del ticket con los mismos nombres que el ticket de una venta
// guardada (nombre científico si el producto es el gemelo de un animal)
export const buildTicketItem = (item, quantity) =>
  toItem(
    { product_id: item.id, quantity, price_unit: item.price_retail },
    { title: item.title },
    item.animal
  );

export function buildLocalSale({ key, folio, soldAt, branchId, method, cart, itemsById }) {
  const totals = cartTotals(cart, itemsById);
  return {
    idempotency_key: key,
    folio,
    sold_at: soldAt,
    branch_id: branchId,
    status: 'pending',
    lines: cart.map((line) => {
      const item = itemsById.get(line.product_id);
      return {
        product_id: line.product_id,
        title: item.title,
        quantity: line.quantity,
        discount: line.discount,
        price_retail: item.price_retail,
        tax_percentage: item.tax_percentage ?? null,
        // para apartar el stock de los componentes mientras no se suba
        components: item.components.map(({ product_id, quantity }) => ({ product_id, quantity })),
        ticketItem: buildTicketItem(item, line.quantity),
      };
    }),
    payment: { method_payment: method, amount: totals.total },
    totals,
  };
}
