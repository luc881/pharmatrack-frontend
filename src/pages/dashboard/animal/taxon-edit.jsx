import { useParams } from 'react-router';

import { CONFIG } from 'src/global-config';

import { TaxonEditView } from 'src/sections/animal/view/taxon-edit-view';

// ----------------------------------------------------------------------

export default function Page({ kind }) {
  const { id } = useParams();
  const what = kind === 'morph' ? 'variedad' : 'especie';
  const title = `${id ? 'Editar' : 'Nueva'} ${what} | Dashboard - ${CONFIG.appName}`;

  return (
    <>
      <title>{title}</title>

      <TaxonEditView kind={kind} id={id} />
    </>
  );
}
