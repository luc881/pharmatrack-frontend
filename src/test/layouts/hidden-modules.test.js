import { it, vi, expect, describe, afterEach } from 'vitest';

// VITE_HIDE_MODULES se lee al importar: cada caso recarga los módulos.
async function load(hide) {
  vi.resetModules();
  vi.stubEnv('VITE_HIDE_MODULES', hide);
  const { navData } = await import('src/layouts/nav-config-dashboard');
  const { SECTIONS } = await import('src/layouts/dashboard/section-tabs-config');
  return {
    titles: navData.flatMap((s) => s.items.map((i) => i.title)),
    subheaders: navData.map((s) => s.subheader),
    sections: SECTIONS.map((s) => s.key),
  };
}

afterEach(() => vi.unstubAllEnvs());

describe('VITE_HIDE_MODULES', () => {
  it('sin la variable se ve todo (Opuntia)', async () => {
    const { titles, sections } = await load('');
    expect(titles).toEqual(expect.arrayContaining(['Animales', 'Pedidos web', 'Sitio web', 'Sensor ambiental']));
    expect(sections).toEqual(expect.arrayContaining(['animales', 'sitio']));
  });

  it('saca del menú y de las pestañas lo apagado', async () => {
    const { titles, subheaders, sections } = await load('animales, pedidos,sitio,fichas,sensor');
    expect(titles).not.toEqual(expect.arrayContaining(['Animales']));
    ['Pedidos web', 'Sitio web', 'Fichas de cuidados', 'Sensor ambiental'].forEach((t) =>
      expect(titles).not.toContain(t)
    );
    expect(titles).toEqual(expect.arrayContaining(['Nueva venta', 'Productos', 'Ajustes']));
    // un grupo del menú que se queda vacío desaparece
    expect(subheaders).not.toContain('Sitio web');
    expect(sections).not.toContain('animales');
    expect(sections).not.toContain('sitio');
  });
});
