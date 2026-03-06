import { CONFIG } from 'src/global-config';

import { RefundProductCreateView } from 'src/sections/refund-product/view';

const metadata = { title: `Nueva devolución | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><RefundProductCreateView /></>);
}
