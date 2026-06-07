import { CONFIG } from 'src/global-config';

import { ProductBatchListView } from 'src/sections/product-batch/view';

const metadata = { title: `Lotes y Stock | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><ProductBatchListView /></>);
}
