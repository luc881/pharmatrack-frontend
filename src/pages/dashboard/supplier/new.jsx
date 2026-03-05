import { CONFIG } from 'src/global-config';

import { SupplierCreateView } from 'src/sections/supplier/view';

// ----------------------------------------------------------------------

const metadata = { title: `Nuevo proveedor | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>
      <SupplierCreateView />
    </>
  );
}
