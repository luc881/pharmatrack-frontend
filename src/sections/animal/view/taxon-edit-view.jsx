import { useLocation, useSearchParams } from 'react-router';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { DashboardContent } from 'src/layouts/dashboard';
import { useAllGenera, useAllMorphs, useAllSpecies, useAnimalGroupTree } from 'src/actions/animal';

import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { flattenGroupTree } from '../utils';
import { TaxonDialog } from '../taxon-dialog';

// ----------------------------------------------------------------------

// Especie o variedad (`kind`: species | morph) en su propia página: aquí se
// editan sus fotos y la ficha de cuidados que ve el cliente en la tienda.
// Sin `id` es un alta; ?species_id= dice de qué especie es la variedad nueva.
export function TaxonEditView({ kind, id }) {
  const router = useRouter();
  const [searchParams] = useSearchParams();
  const { state } = useLocation();
  const back = state?.from ?? paths.dashboard.animal.taxonomy;

  const { species, speciesLoading, speciesMutate } = useAllSpecies();
  const { genera, generaMutate } = useAllGenera();
  const { morphs, morphsLoading, morphsMutate } = useAllMorphs();
  const { groupTree } = useAnimalGroupTree();

  const isMorph = kind === 'morph';
  const list = isMorph ? morphs : species;
  const loading = isMorph ? morphsLoading : speciesLoading;
  const current = id ? list.find((item) => item.id === Number(id)) : null;

  if (id && !current) {
    return loading ? (
      <LoadingScreen />
    ) : (
      <EmptyContent title={isMorph ? 'Esta variedad ya no existe' : 'Esta especie ya no existe'} />
    );
  }

  const speciesId = Number(searchParams.get('species_id'));

  return (
    <DashboardContent>
      <TaxonDialog
        asPage
        key={current?.id ?? 'new'}
        tab={isMorph ? 'morphs' : 'species'}
        singular={isMorph ? 'variedad' : 'especie'}
        current={current}
        initial={isMorph && speciesId ? { species_id: speciesId } : null}
        genera={genera}
        allSpecies={species}
        groupsFlat={flattenGroupTree(groupTree)}
        onClose={() => router.push(back)}
        onSaved={async () => {
          await Promise.all([speciesMutate(), morphsMutate(), generaMutate()]);
        }}
      />
    </DashboardContent>
  );
}
