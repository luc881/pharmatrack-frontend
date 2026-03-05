import { CONFIG } from 'src/global-config';

import { SaleCreateView } from 'src/sections/sale/view';

// ----------------------------------------------------------------------

const metadata = { title: `Nueva venta | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>
      <SaleCreateView />
    </>
  );
}
