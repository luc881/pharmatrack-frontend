import { CONFIG } from 'src/global-config';

import { CareSheetListView } from 'src/sections/care-sheet/view';

const metadata = { title: `Fichas de cuidados | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>
      <CareSheetListView />
    </>
  );
}
