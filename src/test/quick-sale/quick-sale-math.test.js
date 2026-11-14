import { it, expect, describe } from 'vitest';

import {
  usage,
  stockOf,
  lineTotals,
  cartTotals,
  maxDiscount,
  spreadDiscount,
} from 'src/sections/quick-sale/quick-sale-math';

const cueva = {
  id: 1,
  price_retail: '80.00',
  tax_percentage: 16,
  max_discount: 10,
  stock: 8,
  is_bundle: false,
  components: [],
};
const pack = {
  id: 2,
  price_retail: '200.00',
  tax_percentage: null,
  max_discount: null,
  stock: null,
  is_bundle: true,
  components: [{ product_id: 1, quantity: 3, stock: 8 }],
};
const byId = new Map([
  [1, cueva],
  [2, pack],
]);

describe('venta rápida: cálculo', () => {
  it('total de línea igual al del servidor', () => {
    expect(lineTotals(cueva, 2, 10)).toEqual({ subtotal: 150, tax: 24, total: 174 });
  });

  it('no arrastra errores de punto flotante', () => {
    const dime = { ...cueva, price_retail: '0.10', tax_percentage: null };
    expect(lineTotals(dime, 3)).toEqual({ subtotal: 0.3, tax: 0, total: 0.3 });
  });

  it('suma la cuenta completa', () => {
    const lines = [
      { product_id: 1, quantity: 2, discount: 10 },
      { product_id: 2, quantity: 1, discount: 0 },
    ];
    expect(cartTotals(lines, byId)).toEqual({ subtotal: 350, discount: 10, tax: 24, total: 374 });
  });

  it('tope de descuento por línea', () => {
    expect(maxDiscount(cueva, 2)).toBe(16);
    expect(maxDiscount(pack, 1)).toBeNull();
  });

  it('reparte el descuento y avisa lo que no cupo', () => {
    const lines = [
      { product_id: 1, quantity: 1, discount: 0 },
      { product_id: 2, quantity: 1, discount: 0 },
    ];
    const r = spreadDiscount(lines, byId, 20);
    expect(r.lines.map((l) => l.discount)).toEqual([8, 40]);
    expect(r.unapplied).toBe(8);
  });

  it('el stock descuenta las ventas sin subir, también vía paquete', () => {
    const used = usage([
      {
        status: 'pending',
        lines: [{ product_id: 2, quantity: 1, components: [{ product_id: 1, quantity: 3 }] }],
      },
      { status: 'synced', lines: [{ product_id: 1, quantity: 5, components: [] }] },
    ]);
    expect(stockOf(cueva, used)).toBe(5);
    expect(stockOf(pack, used)).toBe(1);
  });

  it('una venta por revisar también aparta stock', () => {
    const used = usage([
      { status: 'review', lines: [{ product_id: 1, quantity: 2, components: [] }] },
    ]);
    expect(stockOf(cueva, used)).toBe(6);
  });

  it('una venta por revisar que el servidor ya registró no aparta dos veces', () => {
    const used = usage([
      { status: 'review', sale_id: 9, lines: [{ product_id: 1, quantity: 2, components: [] }] },
    ]);
    expect(stockOf(cueva, used)).toBe(8);
  });

  it('sin control de lotes no hay número de stock', () => {
    expect(stockOf({ ...cueva, stock: null }, new Map())).toBeNull();
    expect(
      stockOf({ ...pack, components: [{ product_id: 1, quantity: 3, stock: null }] }, new Map())
    ).toBeNull();
  });

  it('el stock nunca es negativo', () => {
    expect(stockOf(cueva, new Map([[1, 99]]))).toBe(0);
  });
});
