// Cálculo de la venta rápida. Tiene que dar lo mismo que el servidor
// (build_sale_detail + recalc_sale_totals en el API): por línea,
// precio × cantidad − descuento; impuesto sobre ese subtotal; total = suma.
// Todo en centavos enteros para no arrastrar errores de punto flotante.

// «100,50» y «100.50» valen lo mismo
export const toNumber = (text) => Number(String(text).trim().replace(',', '.'));

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

// Cuánto de la cuenta es de cada dueño (consignor_id; null = propio): el total
// de cada línea, ya con su descuento e impuesto. Propio va primero.
export function ownerSplit(lines, itemsById) {
  const byOwner = new Map();
  lines.forEach((line) => {
    const item = itemsById.get(line.product_id);
    if (!item) return;
    const owner = item.consignor_id ?? null;
    const { total } = lineCents(item, line.quantity, line.discount);
    byOwner.set(owner, (byOwner.get(owner) ?? 0) + total);
  });
  return [...byOwner]
    .map(([consignor_id, total]) => ({ consignor_id, total: pesos(total) }))
    .sort((a, b) => (a.consignor_id !== null) - (b.consignor_id !== null));
}

// Con nombre, para mostrarlo; `suppliers` son los dueños guardados en el equipo
export const namedSplit = (lines, itemsById, suppliers = []) =>
  ownerSplit(lines, itemsById).map((part) => ({
    ...part,
    name:
      part.consignor_id === null
        ? 'Propio'
        : (suppliers.find((s) => s.id === part.consignor_id)?.name ?? 'En consigna'),
  }));

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

// Unidades que el catálogo guardado todavía no trae restadas, por producto.
// Un paquete cuenta como sus componentes. Una venta que el servidor ya
// registró (synced, o por revisar con sale_id) deja de contarse solo cuando
// el catálogo se pidió DESPUÉS de subirla (`catalogAt`): si esa descarga
// falla, el stock no "regresa" y no se vende dos veces lo mismo.
export function usage(sales, catalogAt) {
  const used = new Map();
  const add = (id, qty) => used.set(id, (used.get(id) ?? 0) + qty);
  sales.forEach((sale) => {
    const uploaded = sale.status === 'synced' || Boolean(sale.sale_id);
    const newerThanCatalog = Boolean(catalogAt && sale.synced_at && sale.synced_at >= catalogAt);
    if (uploaded && !newerThanCatalog) return;
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
