import { CONFIG } from 'src/global-config';

import { PurchaseCreateView } from 'src/sections/purchase/view';

// ----------------------------------------------------------------------

const metadata = { title: `Nueva compra | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>
      <PurchaseCreateView />
    </>
  );
}
