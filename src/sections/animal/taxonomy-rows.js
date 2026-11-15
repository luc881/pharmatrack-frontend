// ----------------------------------------------------------------------
// Filas de la pestaña Especies de «Especies y morphs»: cada especie y, debajo,
// sus variedades. Plegadas para que una especie con muchas no empuje al resto
// fuera de la página; al buscar o filtrar por sitio van todas.
// ----------------------------------------------------------------------

export function buildSpeciesTree(allSpecies, morphsBySpecies, { expanded, showAll = false }) {
  const rows = [];
  allSpecies.forEach((sp) => {
    rows.push({ ...sp, _rowId: `s${sp.id}`, __kind: 'species', depth: 0 });
    if (showAll || expanded.has(sp.id)) {
      (morphsBySpecies[sp.id] ?? []).forEach((m) =>
        rows.push({ ...m, _rowId: `m${m.id}`, __kind: 'morph', depth: 1, __speciesId: sp.id })
      );
    }
  });
  return rows;
}

const unquote = (name) => String(name ?? '').replace(/^'+|'+$/g, '');

const speciesWords = (sp) =>
  [sp?.genus?.name, sp?.name, sp?.common_name].filter(Boolean).join(' ');

// Lo que el buscador mira de cada fila (no lo que se ve): una variedad lleva
// el nombre de su especie, y una especie el de sus variedades. Así «murina»
// trae a Glacier y «glacier» trae a Cubaris murina.
export function searchText(row, speciesById, morphsBySpecies) {
  if (row.__kind === 'morph') {
    return `${speciesWords(speciesById[row.__speciesId])} ${unquote(row.name)}`;
  }
  const varieties = (morphsBySpecies[row.id] ?? []).map((m) => unquote(m.name));
  return [speciesWords(row), 'Nominal', ...varieties].join(' ');
}
