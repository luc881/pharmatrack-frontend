import { CONFIG } from 'src/global-config';

import { RefundProductListView } from 'src/sections/refund-product/view';

const metadata = { title: `Devoluciones | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><RefundProductListView /></>);
}
