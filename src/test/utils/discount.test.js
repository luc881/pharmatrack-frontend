import { it, expect, describe } from 'vitest';

import { applyDiscount, removeDiscount, discountPercent } from 'src/utils/discount';

describe('descuento por porcentaje', () => {
  it('baja el precio y deja el de antes tachado', () => {
    expect(applyDiscount(600, null, 20)).toEqual({ price: 480, compare_at_price: 600 });
  });

  it('no se acumula: con oferta previa se calcula sobre el precio de antes', () => {
    expect(applyDiscount(540, 600, 20)).toEqual({ price: 480, compare_at_price: 600 });
  });

  it('redondea a pesos enteros', () => {
    expect(applyDiscount(149, null, 15)).toEqual({ price: 127, compare_at_price: 149 });
  });

  it('si el redondeo no baja el precio, no hay cambio', () => {
    expect(applyDiscount(10, null, 1)).toBeNull();
  });

  it('con redondeo a decenas queda en la decena más cercana', () => {
    const tens = (price) => applyDiscount(price, null, 15, { tens: true })?.price;
    expect(tens(60)).toBe(50); // 51
    expect(tens(50)).toBe(40); // 42.5
    expect(tens(150)).toBe(130); // 127.5
    expect(tens(184)).toBe(160); // 156.4
  });

  it('si la decena no baja el precio o lo deja en cero, no hay cambio', () => {
    expect(applyDiscount(60, null, 5, { tens: true })).toBeNull(); // 57 → 60
    expect(applyDiscount(8, null, 50, { tens: true })).toBeNull(); // 4 → 0
  });

  it('quitar el descuento regresa al precio de antes', () => {
    expect(removeDiscount(480, 600)).toEqual({ price: 600, compare_at_price: null });
    expect(removeDiscount(480, null)).toBeNull();
  });

  it('dice cuánto descuento tiene', () => {
    expect(discountPercent(480, 600)).toBe(20);
    expect(discountPercent('127.00', '149.00')).toBe(15);
    expect(discountPercent(600, null)).toBeNull();
    expect(discountPercent(600, 500)).toBeNull();
  });
});
