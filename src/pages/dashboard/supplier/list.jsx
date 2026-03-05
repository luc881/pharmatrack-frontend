import { CONFIG } from 'src/global-config';

import { SupplierListView } from 'src/sections/supplier/view';

// ----------------------------------------------------------------------

const metadata = { title: `Proveedores | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>
      <SupplierListView />
    </>
  );
}
