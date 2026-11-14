import { IDBFactory } from 'fake-indexeddb';
import { it, expect, describe, beforeEach } from 'vitest';
import { act, waitFor, renderHook } from '@testing-library/react';

import { useQuickSale } from 'src/sections/quick-sale/use-quick-sale';
import { setKV, addSale } from 'src/sections/quick-sale/quick-sale-store';

const cueva = {
  id: 1,
  title: 'Cueva',
  price_retail: '80.00',
  tax_percentage: null,
  max_discount: 10,
  stock: 8,
  is_bundle: false,
  components: [],
  blocked_reason: null,
};
const pack = {
  id: 2,
  title: '3 cuevas',
  price_retail: '200.00',
  tax_percentage: null,
  max_discount: null,
  stock: null,
  is_bundle: true,
  components: [{ product_id: 1, quantity: 3, stock: 8 }],
  blocked_reason: null,
};
const reserved = { ...cueva, id: 3, title: 'Reservado', stock: 1, blocked_reason: 'reserved' };

const catalog = () => setKV('catalog', { items: [cueva, pack, reserved], fetchedAt: 'x' });
const pending = (quantity) =>
  addSale({
    idempotency_key: 'llave-0001',
    sold_at: '2026-11-22T18:00:00.000Z',
    status: 'pending',
    lines: [{ product_id: 1, quantity, components: [] }],
  });

async function setup() {
  const view = renderHook(() => useQuickSale());
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  return view;
}

describe('venta rápida: estado de la cuenta', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('sin catálogo guardado no hay productos', async () => {
    const { result } = await setup();
    expect(result.current.items).toBeNull();
  });

  it('el stock descuenta las ventas sin subir, también tras volver a bajar el catálogo', async () => {
    await catalog();
    await pending(3);
    const { result } = await setup();
    expect(result.current.stockOf(cueva)).toBe(5);

    await catalog(); // el servidor aún no sabe de la venta pendiente: vuelve a decir 8
    await act(() => result.current.reload());
    expect(result.current.stockOf(cueva)).toBe(5);
    expect(result.current.counts).toEqual({ pending: 1, review: 0 });
  });

  it('no deja agregar más de lo que hay', async () => {
    await catalog();
    await pending(3);
    const { result } = await setup();
    for (let i = 0; i < 6; i += 1) act(() => result.current.add(cueva));
    expect(result.current.cart).toEqual([{ product_id: 1, quantity: 5, discount: 0 }]);
    expect(result.current.stockOf(cueva)).toBe(0);
    expect(result.current.totals.total).toBe(400);
  });

  it('un paquete en la cuenta aparta sus componentes', async () => {
    await catalog();
    const { result } = await setup();
    act(() => result.current.add(pack));
    act(() => result.current.add(pack));
    expect(result.current.stockOf(cueva)).toBe(2);
    expect(result.current.stockOf(pack)).toBe(0);
    act(() => result.current.add(pack));
    expect(result.current.cart[0].quantity).toBe(2);
  });

  it('no agrega un animal bloqueado', async () => {
    await catalog();
    const { result } = await setup();
    act(() => result.current.add(reserved));
    expect(result.current.cart).toEqual([]);
  });

  it('el descuento respeta el tope y se ajusta al bajar la cantidad', async () => {
    await catalog();
    const { result } = await setup();
    act(() => result.current.add(cueva));
    act(() => result.current.add(cueva));

    let error;
    act(() => {
      error = result.current.setDiscount(1, 20);
    });
    expect(error).toMatch(/16/);
    expect(result.current.cart[0].discount).toBe(0);

    act(() => {
      error = result.current.setDiscount(1, 16);
    });
    expect(error).toBeNull();
    expect(result.current.totals.total).toBe(144);

    act(() => result.current.setQuantity(1, 1));
    expect(result.current.cart[0].discount).toBe(8);

    act(() => result.current.setQuantity(1, 0));
    expect(result.current.cart).toEqual([]);
  });

  it('descuento a toda la cuenta', async () => {
    await catalog();
    const { result } = await setup();
    act(() => result.current.add(cueva));
    act(() => result.current.add(pack));
    let unapplied;
    act(() => {
      unapplied = result.current.discountAll(20);
    });
    expect(unapplied).toBe(8);
    expect(result.current.cart.map((l) => l.discount)).toEqual([8, 40]);
  });
  it('una venta recién subida no devuelve su stock si el catálogo es anterior', async () => {
    await setKV('catalog', {
      items: [cueva, pack, reserved],
      fetchedAt: '2026-11-22T18:00:01.000Z',
      requestedAt: '2026-11-22T18:00:00.000Z',
    });
    await addSale({
      idempotency_key: 'llave-0009',
      sold_at: '2026-11-22T18:04:00.000Z',
      status: 'synced',
      sale_id: 77,
      synced_at: '2026-11-22T18:05:00.000Z',
      lines: [{ product_id: 1, quantity: 3, components: [] }],
    });
    const { result } = await setup();
    expect(result.current.stockOf(cueva)).toBe(5);
  });
});
