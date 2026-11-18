import { it, expect, describe } from 'vitest';

import { toItem } from 'src/sections/sale/print-ticket';

// El renglón de un animal dice qué se vendió: el lote (por pieza) o el
// ejemplar (individual, por su código).
const detail = { product_id: 1, quantity: 1, price_unit: 600 };
const species = (sale_format) => ({
  name: 'Gardabagusi',
  common_name: 'Insecto hoja',
  sale_format,
  genus: { name: 'Phyllium' },
});

describe('renglón del ticket de un animal', () => {
  it('por pieza lleva el sexo del lote', () => {
    const item = toItem(detail, null, { code: 'AN-1', sex: 'female', species: species('piece') });
    expect(item.detalle).toBe('Hembra');
  });

  it('individual lleva el código del ejemplar', () => {
    const item = toItem(detail, null, {
      code: 'G-12',
      sex: 'female',
      morphs: [{ name: 'Tangerine' }],
      species: species('individual'),
    });
    expect(item.detalle).toBe('Tangerine · G-12');
  });

  it('un paquete no lleva código', () => {
    const item = toItem(detail, null, {
      code: 'AN-9',
      species: { ...species('package'), package_size: 6 },
    });
    expect(item.detalle).toBe('6 pzas');
  });
});
