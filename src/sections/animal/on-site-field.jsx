import { useMemo } from 'react';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import {
  updateMorph,
  useAllMorphs,
  updateSpecies,
  useAllSpecies,
  useAnimalGroupTree,
} from 'src/actions/animal';

import { toast } from 'src/components/snackbar';

import { flattenGroupTree } from './utils';

// ----------------------------------------------------------------------
// «Mostrar en el sitio» al dar de alta algo en venta. En el sitio no se
// anuncia el ejemplar suelto sino su especie o su variedad, así que esto
// cambia la de lo que se está dando de alta (y lo dice). La misma regla que
// el catálogo público: un grupo oculto esconde todo, una especie oculta
// esconde sus variedades.
// ----------------------------------------------------------------------

// speciesId, morphIds: lo elegido en el buscador. Una variedad con nombre
// (un morph) se maneja sola; la nominal o una combinación de genes, por especie.
export function useOnSite(speciesId, morphIds = []) {
  const { species: allSpecies, speciesMutate } = useAllSpecies();
  const { morphs, morphsMutate } = useAllMorphs();
  const { groupTree } = useAnimalGroupTree();

  return useMemo(() => {
    const species = allSpecies.find((s) => s.id === Number(speciesId)) ?? null;
    const morph = morphIds.length === 1 ? (morphs.find((m) => m.id === morphIds[0]) ?? null) : null;

    const groups = flattenGroupTree(groupTree);
    const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
    const group = byId[species?.genus?.group?.id ?? species?.genus?.group_id];
    const groupHidden = Boolean(
      group &&
      (group.show_public === false || group.ancestors.some((id) => byId[id]?.show_public === false))
    );

    const speciesOn = species?.show_public !== false;
    const current = speciesOn && (morph ? morph.show_public !== false : true);

    // Deja la especie o la variedad como se pidió; sin cambio, no toca nada.
    // Va después del alta: si falla, el animal ya quedó y solo se avisa esto.
    const apply = async (want) => {
      if (!species || want === current) return;
      try {
        await write(want);
      } catch (error) {
        toast.error(
          `Quedó dado de alta, pero no se pudo cambiar si se ve en el sitio: ${error?.message ?? ''}`
        );
      }
      await Promise.all([speciesMutate(), morphsMutate()]);
    };

    const write = async (want) => {
      if (!morph) {
        await updateSpecies(species.id, { show_public: want });
      } else if (want) {
        // mostrar una variedad de una especie oculta muestra también la especie
        if (!speciesOn) await updateSpecies(species.id, { show_public: true });
        if (morph.show_public === false) await updateMorph(morph.id, { show_public: true });
      } else {
        await updateMorph(morph.id, { show_public: false });
      }
    };

    return { species, morph, current, groupHidden, apply };
  }, [allSpecies, morphs, groupTree, speciesId, morphIds, speciesMutate, morphsMutate]);
}

// value: lo que se va a guardar (null = como está hoy)
export function OnSiteField({ onSite, value, onChange }) {
  const { species, morph, current, groupHidden } = onSite;
  if (!species) return null;

  const scope = morph
    ? `Aplica a toda la variedad «${morph.name}».`
    : 'Aplica a toda la especie, con sus variedades.';

  return (
    <Box>
      <FormControlLabel
        control={
          <Checkbox
            checked={!groupHidden && (value ?? current)}
            disabled={groupHidden}
            onChange={(e) => onChange(e.target.checked)}
          />
        }
        label="Mostrar en el sitio"
      />
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', ml: 4 }}>
        {groupHidden
          ? 'Su grupo está oculto en el sitio: se cambia en «Especies y morphs».'
          : `${scope} Se cambia después en Animales → «En venta».`}
      </Typography>
    </Box>
  );
}
