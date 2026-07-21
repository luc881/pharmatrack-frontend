import { useParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';
import { useGetSpecies } from 'src/actions/animal';

import { SpeciesDetailView } from 'src/sections/animal/view';

const metadata = { title: `Ficha de especie | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  const { id } = useParams();
  const { species, speciesLoading, speciesError, speciesMutate } = useGetSpecies(id);
  return (
    <>
      <title>{metadata.title}</title>
      <SpeciesDetailView
        species={species}
        loading={speciesLoading}
        error={speciesError}
        onMutate={speciesMutate}
      />
    </>
  );
}
