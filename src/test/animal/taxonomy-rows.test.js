import { it, expect, describe } from 'vitest';

import { searchText, buildSpeciesTree } from 'src/sections/animal/taxonomy-rows';

// ----------------------------------------------------------------------
// Tabla de Especies y morphs: buscar «murina» trae la especie con todas sus
// variedades; buscar «glacier» trae Glacier con su especie arriba.
// ----------------------------------------------------------------------

const MURINA = { id: 1, name: 'Murina', common_name: null, genus: { name: 'Cubaris' } };
const DUCKY = { id: 2, name: 'Sp.', common_name: 'Rubber Ducky', genus: { name: 'Cubaris' } };
const morphsBySpecies = {
  1: [
    { id: 11, name: "'Glacier'", species_id: 1 },
    { id: 12, name: "'Anemone'", species_id: 1 },
  ],
};
const speciesById = { 1: MURINA, 2: DUCKY };

const ids = (rows) => rows.map((r) => r._rowId);

describe('filas de especies y variedades', () => {
  it('plegadas no traen variedades; desplegadas sí', () => {
    expect(ids(buildSpeciesTree([MURINA, DUCKY], morphsBySpecies, { expanded: new Set() }))).toEqual([
      's1',
      's2',
    ]);
    expect(
      ids(buildSpeciesTree([MURINA, DUCKY], morphsBySpecies, { expanded: new Set([1]) }))
    ).toEqual(['s1', 'm11', 'm12', 's2']);
  });

  it('al buscar van todas las variedades, aunque la especie esté plegada', () => {
    expect(
      ids(buildSpeciesTree([MURINA], morphsBySpecies, { expanded: new Set(), showAll: true }))
    ).toEqual(['s1', 'm11', 'm12']);
  });

  it('una variedad se encuentra por su nombre o por el de su especie', () => {
    const [, glacier] = buildSpeciesTree([MURINA], morphsBySpecies, { expanded: new Set([1]) });
    const text = searchText(glacier, speciesById, morphsBySpecies);
    expect(text).toContain('Glacier');
    expect(text).toContain('Cubaris Murina');
  });

  it('una especie se encuentra también por el nombre de sus variedades', () => {
    const [murina] = buildSpeciesTree([MURINA], morphsBySpecies, { expanded: new Set() });
    const text = searchText(murina, speciesById, morphsBySpecies);
    expect(text).toContain('Cubaris Murina');
    expect(text).toContain('Glacier');
    expect(text).toContain('Anemone');
    expect(text).toContain('Nominal');
  });
});
