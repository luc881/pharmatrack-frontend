import { useMemo } from 'react';

import Stack from '@mui/material/Stack';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';

import { matchesWords } from 'src/utils/plain';

import { useAllMorphs, useAllSpecies } from 'src/actions/animal';

import { speciesLabel } from './utils';

// ----------------------------------------------------------------------
// Especie y variedad en un solo buscador.
//
// Mucha gente conoce «Glacier» o «Papaya» sin saber que son de Cubaris
// murina: aquí se busca por nombre común, científico o de la variedad, y la
// lista sale agrupada por especie con sus variedades debajo (la base es
// «Nominal»). Hay dos tipos de especie (species.variety_mode):
//   named → variedades con nombre: el ejemplar es UNA (o nominal)
//   genes → genes combinables (reptiles): se elige la especie y debajo se
//           marcan los genes que lleva
// En la base, nominal = sin morph; nada de esto cambia los datos.
// ----------------------------------------------------------------------

export const NOMINAL = 'Nominal';

export const isGeneSpecies = (species) => species?.variety_mode === 'genes';

// «Glacier», «Banana Pastel» o «Nominal»
export const varietyName = (morphs) =>
  morphs?.length ? morphs.map((m) => m.name).join(' ') : NOMINAL;

// Las opciones del buscador: por especie, la nominal y luego sus variedades;
// una especie de genes es una sola opción (los genes se marcan aparte)
export function varietyOptions(species, morphs, { genesAsOptions = false } = {}) {
  const bySpecies = new Map();
  morphs.forEach((m) => {
    if (!bySpecies.has(m.species_id)) bySpecies.set(m.species_id, []);
    bySpecies.get(m.species_id).push(m);
  });
  return [...species]
    .sort((a, b) => speciesLabel(a).localeCompare(speciesLabel(b)))
    .flatMap((sp) => {
      const base = { key: `s${sp.id}`, species: sp, morph: null };
      if (isGeneSpecies(sp) && !genesAsOptions) return [base];
      const own = [...(bySpecies.get(sp.id) ?? [])].sort((a, b) => a.name.localeCompare(b.name));
      return [base, ...own.map((m) => ({ key: `m${m.id}`, species: sp, morph: m }))];
    });
}

// baseLabel: cómo se llama la opción base de cada especie. Al dar de alta es
// «Nominal»; en un filtro, «Todas las variedades».
const nameOf = (option, baseLabel) =>
  option.morph
    ? option.morph.name
    : isGeneSpecies(option.species) && baseLabel === NOMINAL
      ? 'Elegir genes…'
      : baseLabel;

// Lo que queda escrito en el campo al elegir
const labelOf = (option, baseLabel) =>
  isGeneSpecies(option.species) && !option.morph
    ? speciesLabel(option.species)
    : `${speciesLabel(option.species)} · ${nameOf(option, baseLabel)}`;

// value: { speciesId, morphIds }   onChange({ species, morphIds })
// `species`: lista ya filtrada (por grupo o género); por omisión, todas.
// `filter`: es un filtro de búsqueda, no un alta: la opción base es «todas
// las variedades» y una especie de genes también lista sus genes sueltos.
export function VarietyPicker({
  filter = false,
  value,
  onChange,
  species,
  label = 'Especie y variedad',
  error,
  helperText,
  autoFocus,
  disabled,
  size,
  sx,
}) {
  const { species: allSpecies } = useAllSpecies();
  const { morphs } = useAllMorphs();
  const list = species ?? allSpecies;

  const baseLabel = filter ? 'Todas las variedades' : NOMINAL;
  const options = useMemo(
    () => varietyOptions(list, morphs, { genesAsOptions: filter }),
    [list, morphs, filter]
  );
  const optionName = (option) => nameOf(option, baseLabel);

  const speciesId = value?.speciesId ? Number(value.speciesId) : null;
  const morphIds = value?.morphIds ?? [];
  // La especie elegida puede no estar en una lista filtrada: se busca en todas
  const selectedSpecies = allSpecies.find((s) => s.id === speciesId) ?? null;
  // en un filtro los genes ya van como opciones sueltas
  const genes = !filter && isGeneSpecies(selectedSpecies);
  const geneOptions = useMemo(
    () =>
      morphs.filter((m) => m.species_id === speciesId).sort((a, b) => a.name.localeCompare(b.name)),
    [morphs, speciesId]
  );

  const selected = !selectedSpecies
    ? null
    : (genes && !filter) || !morphIds.length
      ? { key: `s${speciesId}`, species: selectedSpecies, morph: null }
      : {
          key: `m${morphIds[0]}`,
          species: selectedSpecies,
          morph: morphs.find((m) => m.id === morphIds[0]) ?? { id: morphIds[0], name: '…' },
        };

  return (
    <Stack spacing={2} sx={sx}>
      <Autocomplete
        fullWidth
        size={size}
        disabled={disabled}
        options={options}
        value={selected}
        onChange={(_, option) =>
          onChange(
            option
              ? {
                  species: option.species,
                  morphIds: option.morph
                    ? [option.morph.id]
                    : // misma especie de genes: no se pierden los ya marcados
                      genes && option.species.id === speciesId
                      ? morphIds
                      : [],
                }
              : { species: null, morphIds: [] }
          )
        }
        groupBy={(option) => speciesLabel(option.species)}
        getOptionLabel={(option) => labelOf(option, baseLabel)}
        isOptionEqualToValue={(option, current) => option.key === current.key}
        // nombre común, científico o de la variedad; sin acentos
        filterOptions={(all, { inputValue }) =>
          all.filter((option) =>
            matchesWords(`${speciesLabel(option.species)} ${optionName(option)}`, inputValue)
          )
        }
        renderOption={({ key, ...props }, option) => (
          <li key={option.key} {...props} style={{ ...props.style, paddingLeft: 32 }}>
            {optionName(option)}
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            autoFocus={autoFocus}
            label={label}
            error={Boolean(error)}
            helperText={helperText}
          />
        )}
      />

      {genes && (
        <Autocomplete
          multiple
          fullWidth
          size={size}
          disableCloseOnSelect
          disabled={disabled}
          options={geneOptions}
          value={geneOptions.filter((m) => morphIds.includes(m.id))}
          onChange={(_, chosen) =>
            onChange({ species: selectedSpecies, morphIds: chosen.map((m) => m.id) })
          }
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(option, current) => option.id === current.id}
          renderOption={({ key, ...props }, option, { selected: checked }) => (
            <li key={key} {...props}>
              <Checkbox size="small" disableRipple checked={checked} sx={{ mr: 1 }} />
              {option.name}
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Genes"
              helperText={
                geneOptions.length
                  ? 'Los que lleva este ejemplar; sin marcar ninguno es la forma base.'
                  : 'Esta especie aún no tiene genes dados de alta.'
              }
            />
          )}
        />
      )}
    </Stack>
  );
}
