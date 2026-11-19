import { it, expect, describe } from 'vitest';

import { priceListRows, priceListSections } from 'src/sections/animal/price-list';

const LILA = { id: 1, common_name: 'Colembolo Lila', name: 'isabellae', genus: { name: 'Ceratophysella' }, sale_format: 'colony' };
const MURINA = { id: 2, common_name: 'Isópodo Murina', name: 'murina', genus: { name: 'Cubaris' }, sale_format: 'package', package_size: 6 };

const lot = (species, { morphs = [], price, compare = null, stock = 10, ...extra }) => ({
  species,
  morphs,
  price,
  compare_at_price: compare,
  stock,
  status: 'available',
  purpose: 'sale',
  ...extra,
});

const GLACIER = { id: 7, name: 'Glacier' };
const ROSA = { id: 8, name: 'Rosa' };

describe('lista de precios', () => {
  it('una fila por variedad, sin anidar, con la nominal primero', () => {
    const rows = priceListRows([
      { species: LILA, animals: [lot(LILA, { morphs: [ROSA], price: 300 }), lot(LILA, { price: 150, stock: 20 })] },
      { species: MURINA, animals: [lot(MURINA, { morphs: [GLACIER], price: 350 })] },
    ]);
    expect(rows.map((r) => [r.name, r.variety, r.units, r.price])).toEqual([
      ['Colembolo Lila', null, 20, '$150'],
      ['Colembolo Lila', 'Rosa', 10, '$300'],
      ['Isópodo Murina', 'Glacier', 10, '$350'],
    ]);
    expect(rows[2].format).toBe('Paquete de 6');
  });

  it('con descuento lleva el precio original, el actual y el porcentaje', () => {
    const [row] = priceListRows([
      { species: LILA, animals: [lot(LILA, { price: 240, compare: 300 })] },
    ]);
    expect(row).toMatchObject({ price: '$240', original: '$300', discount: '−20%' });
  });

  it('sin descuento no lleva original ni porcentaje', () => {
    const [row] = priceListRows([{ species: LILA, animals: [lot(LILA, { price: 150 })] }]);
    expect(row).toMatchObject({ original: null, discount: null });
  });

  it('descuentos distintos en la misma variedad dicen «hasta»', () => {
    const [row] = priceListRows([
      {
        species: LILA,
        animals: [lot(LILA, { price: 270, compare: 300 }), lot(LILA, { price: 150, compare: 200 })],
      },
    ]);
    expect(row).toMatchObject({ price: '$150 – $270', original: '$200 – $300', discount: 'hasta −25%' });
  });

  it('deja fuera lo vendido, lo de cría y los lotes vacíos', () => {
    const rows = priceListRows([
      {
        species: LILA,
        animals: [
          lot(LILA, { price: 1, status: 'sold' }),
          lot(LILA, { price: 1, purpose: 'breeder' }),
          lot(LILA, { price: 1, stock: 0 }),
        ],
      },
    ]);
    expect(rows).toEqual([]);
  });

  it('se divide por vendedor: lo mío primero y luego cada proveedor', () => {
    const sections = priceListSections(
      [
        {
          species: LILA,
          animals: [
            lot(LILA, { price: 150 }),
            lot(LILA, { morphs: [ROSA], price: 300, consignor_id: 9 }),
          ],
        },
        { species: MURINA, animals: [lot(MURINA, { price: 350, consignor_id: 4 })] },
      ],
      { mine: 'Opuntia Den', suppliers: [{ id: 4, name: 'Zeta' }, { id: 9, name: 'BD Exoticos' }] }
    );
    expect(sections.map((s) => [s.key, s.title, s.rows.map((r) => r.variety ?? r.name)])).toEqual([
      ['mine', 'Opuntia Den', ['Colembolo Lila']],
      ['9', 'BD Exoticos', ['Rosa']],
      ['4', 'Zeta', ['Isópodo Murina']],
    ]);
  });

  it('un vendedor sin nada disponible no sale', () => {
    const sections = priceListSections(
      [{ species: LILA, animals: [lot(LILA, { price: 150, consignor_id: 9, status: 'sold' })] }],
      { mine: 'Míos', suppliers: [{ id: 9, name: 'BD Exoticos' }] }
    );
    expect(sections).toEqual([]);
  });
});
