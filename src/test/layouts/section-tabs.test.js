import { it, expect, describe } from 'vitest';

import { findSection } from 'src/layouts/dashboard/section-tabs-config';

const where = (path) => {
  const f = findSection(path);
  return f && [f.section.key, f.tab.label, f.child?.label ?? null];
};

describe('findSection', () => {
  it('gana el prefijo más largo', () => {
    expect(where('/dashboard/sale')).toEqual(['ventas', 'Historial', null]);
    expect(where('/dashboard/sale/summary')).toEqual(['ventas', 'Corte de caja', null]);
    expect(where('/dashboard/sale/42')).toEqual(['ventas', 'Historial', null]);
    // la plantilla del ticket vive en Ajustes aunque cuelgue de /sale
    expect(where('/dashboard/sale/email-template')).toEqual(['ajustes', 'Datos del negocio', null]);
  });

  it('compara por segmento completo, no por texto', () => {
    expect(where('/dashboard/product')).toEqual(['productos', 'Productos', null]);
    expect(where('/dashboard/product-batch')).toEqual(['productos', 'Stock y lotes', null]);
    expect(where('/dashboard/product/7/edit')).toEqual(['productos', 'Productos', null]);
  });

  it('resuelve sub-pestañas y rutas extra (match)', () => {
    expect(where('/dashboard/product-brand')).toEqual(['productos', 'Categorías y marcas', 'Marcas']);
    expect(where('/dashboard/calendar')).toEqual(['productos', 'Avanzado', 'Calendario de caducidades']);
    expect(where('/dashboard/animal')).toEqual(['animales', 'En venta', null]);
    // la tabla de precios es otra vista de lo que está en venta
    expect(where('/dashboard/animal/sheet')).toEqual(['animales', 'En venta', null]);
    expect(where('/dashboard/animal/breeding')).toEqual(['animales', 'Pie de cría y crianza', null]);
    expect(where('/dashboard/animal/history')).toEqual(['animales', 'Vendidos y bajas', null]);
    expect(where('/dashboard/animal/taxonomy')).toEqual(['animales', 'Especies y morphs', null]);
    expect(where('/dashboard/animal/species/3')).toEqual(['animales', 'Especies y morphs', null]);
    expect(where('/dashboard/animal/species/3/edit')).toEqual(['animales', 'Especies y morphs', null]);
    expect(where('/dashboard/animal/morph/4/edit')).toEqual(['animales', 'Especies y morphs', null]);
    expect(where('/dashboard/user/account')).toEqual(['ajustes', 'Usuarios', null]);
  });

  it('fuera de un área no devuelve nada', () => {
    expect(where('/dashboard')).toBeNull();
    expect(where('/dashboard/order')).toBeNull();
    expect(where('/dashboard/sensor')).toBeNull();
  });
});
