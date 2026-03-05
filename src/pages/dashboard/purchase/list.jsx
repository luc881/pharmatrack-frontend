import { CONFIG } from 'src/global-config';

import { PurchaseListView } from 'src/sections/purchase/view';

// ----------------------------------------------------------------------

const metadata = { title: `Compras | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>
      <PurchaseListView />
    </>
  );
}
