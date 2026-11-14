import { IDBFactory } from 'fake-indexeddb';
import { it, expect, describe, beforeEach } from 'vitest';

import {
  getKV,
  setKV,
  addSale,
  putSale,
  listSales,
  nextFolio,
} from 'src/sections/quick-sale/quick-sale-store';

const sale = (key, extra = {}) => ({
  idempotency_key: key,
  sold_at: '2026-11-22T18:00:00.000Z',
  status: 'pending',
  lines: [],
  ...extra,
});

describe('venta rápida: almacén local', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('guarda y lee valores sueltos', async () => {
    expect(await getKV('catalog')).toBeUndefined();
    await setKV('catalog', { items: [{ id: 1 }], fetchedAt: 'x' });
    expect(await getKV('catalog')).toEqual({ items: [{ id: 1 }], fetchedAt: 'x' });
  });

  it('da folios consecutivos con el mismo prefijo del dispositivo', async () => {
    const a = await nextFolio();
    const b = await nextFolio();
    expect(a).toMatch(/^VR-[A-Z0-9]{4}-0001$/);
    expect(b).toBe(a.replace('0001', '0002'));
  });

  it('dos folios pedidos a la vez no se repiten', async () => {
    const [a, b] = await Promise.all([nextFolio(), nextFolio()]);
    expect(a).not.toBe(b);
  });

  it('una llave repetida no reemplaza la venta', async () => {
    expect(await addSale(sale('llave-0001', { folio: 'A' }))).toBe(true);
    expect(await addSale(sale('llave-0001', { folio: 'B' }))).toBe(false);
    expect((await listSales()).map((s) => s.folio)).toEqual(['A']);
  });

  it('putSale actualiza y listSales ordena por hora', async () => {
    await addSale(sale('llave-0002', { sold_at: '2026-11-22T19:00:00.000Z' }));
    await addSale(sale('llave-0001'));
    await putSale(sale('llave-0002', { sold_at: '2026-11-22T19:00:00.000Z', status: 'synced' }));
    const all = await listSales();
    expect(all.map((s) => s.idempotency_key)).toEqual(['llave-0001', 'llave-0002']);
    expect(all[1].status).toBe('synced');
  });
});
