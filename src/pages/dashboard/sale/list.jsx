import { CONFIG } from 'src/global-config';

import { SaleListView } from 'src/sections/sale/view';

// ----------------------------------------------------------------------

const metadata = { title: `Ventas | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>
      <SaleListView />
    </>
  );
}
