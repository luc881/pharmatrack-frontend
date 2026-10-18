import { CONFIG } from 'src/global-config';

import { CareSheetFormView } from 'src/sections/care-sheet/view';

const metadata = { title: `Ficha de cuidados | Dashboard - ${CONFIG.appName}` };

// Crear (/new) y editar (/:id/edit) comparten página: la vista decide por el :id
export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>
      <CareSheetFormView />
    </>
  );
}
