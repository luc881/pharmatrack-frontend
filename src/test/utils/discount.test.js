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
