// Cálculo de la venta rápida. Tiene que dar lo mismo que el servidor
// (build_sale_detail + recalc_sale_totals en el API): por línea,
// precio × cantidad − descuento; impuesto sobre ese subtotal; total = suma.
// Todo en centavos enteros para no arrastrar errores de punto flotante.

const cents = (value) => Math.round(Number(value || 0) * 100);
const pesos = (c) => c / 100;

function lineCents(item, quantity, discount = 0) {
  const subtotal = Math.round(cents(item.price_retail) * Number(quantity)) - cents(discount);
  const tax = item.tax_percentage ? Math.round((subtotal * Number(item.tax_percentage)) / 100) : 0;
  return { subtotal, tax, total: subtotal + tax };
}

export function lineTotals(item, quantity, discount = 0) {
  const { subtotal, tax, total } = lineCents(item, quantity, discount);
  return { subtotal: pesos(subtotal), tax: pesos(tax), total: pesos(total) };
}

export function cartTotals(lines, itemsById) {
  const sum = { subtotal: 0, discount: 0, tax: 0, total: 0 };
  lines.forEach((line) => {
    const item = itemsById.get(line.product_id);
    if (!item) return;
    const t = lineCents(item, line.quantity, line.discount);
    sum.subtotal += t.subtotal;
    sum.discount += cents(line.discount);
    sum.tax += t.tax;
    sum.total += t.total;
  });
  return {
    subtotal: pesos(sum.subtotal),
    discount: pesos(sum.discount),
    tax: pesos(sum.tax),
    total: pesos(sum.total),
  };
}

// Tope del descuento de una línea en pesos (_check_max_discount en el API);
// null = el producto no tiene tope
export function maxDiscount(item, quantity) {
  if (item.max_discount === null || item.max_discount === undefined) return null;
  return pesos(
    Math.floor((cents(item.price_retail) * Number(quantity) * Number(item.max_discount)) / 100)
  );
}

// «Descuento a la cuenta»: el mismo % en cada línea, sin pasar del tope de
// cada producto. unapplied = pesos que no cupieron por los topes.
export function spreadDiscount(lines, itemsById, percent) {
  let unapplied = 0;
  const next = lines.map((line) => {
    const item = itemsById.get(line.product_id);
    if (!item) return line;
    const wanted = Math.round((cents(item.price_retail) * Number(line.quantity) * percent) / 100);
    const cap = maxDiscount(item, line.quantity);
    const applied = cap === null ? wanted : Math.min(wanted, cents(cap));
    unapplied += wanted - applied;
    return { ...line, discount: pesos(applied) };
  });
  return { lines: next, unapplied: pesos(unapplied) };
}

// Unidades que las ventas del dispositivo todavía no descuentan en el
// servidor, por producto. Un paquete cuenta como sus componentes. Las que el
// servidor ya registró (synced, o por revisar con sale_id) no se cuentan: el
// catálogo descargado ya las trae restadas.
export function usage(sales) {
  const used = new Map();
  const add = (id, qty) => used.set(id, (used.get(id) ?? 0) + qty);
  sales.forEach((sale) => {
    if (sale.status === 'synced' || sale.sale_id) return;
    sale.lines.forEach((line) => {
      if (line.components?.length) {
        line.components.forEach((c) => add(c.product_id, Number(line.quantity) * c.quantity));
      } else {
        add(line.product_id, Number(line.quantity));
      }
    });
  });
  return used;
}

// Existencias que se pueden vender ahora; null = sin control de stock.
// Paquete: lo que alcance del componente más escaso.
export function stockOf(item, used) {
  const left = (id, stock) => Math.max(0, stock - (used.get(id) ?? 0));
  if (item.is_bundle) {
    const tracked = item.components.filter((c) => c.stock !== null && c.stock !== undefined);
    if (!tracked.length) return null;
    return Math.min(...tracked.map((c) => Math.floor(left(c.product_id, c.stock) / c.quantity)));
  }
  if (item.stock === null || item.stock === undefined) return null;
  return left(item.id, item.stock);
}
