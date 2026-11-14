import { CONFIG } from 'src/global-config';

import { QuickSaleView } from 'src/sections/quick-sale/view/quick-sale-view';

// ----------------------------------------------------------------------

const metadata = { title: `Venta rápida | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>
      <QuickSaleView />
    </>
  );
}
