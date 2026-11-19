// Descuento por porcentaje: el precio de antes queda tachado (compare_at_price)
// y baja el precio. Sin acumular: con oferta previa se parte del precio de antes.

const base = (price, compareAt) =>
  Number(compareAt) > Number(price) ? Number(compareAt) : Number(price);

// null = no cambia (el redondeo dejaría el mismo precio o en cero).
// tens: a la decena más cercana (51 → 50, 156 → 160) para no cobrar tan exacto
export function applyDiscount(price, compareAt, percent, { tens = false } = {}) {
  const before = base(price, compareAt);
  const raw = before * (1 - percent / 100);
  const next = tens ? Math.round(raw / 10) * 10 : Math.round(raw);
  return next > 0 && next < before ? { price: next, compare_at_price: before } : null;
}

export function removeDiscount(price, compareAt) {
  return Number(compareAt) > Number(price)
    ? { price: Number(compareAt), compare_at_price: null }
    : null;
}

export function discountPercent(price, compareAt) {
  return Number(compareAt) > Number(price)
    ? Math.round((1 - Number(price) / Number(compareAt)) * 100)
    : null;
}
