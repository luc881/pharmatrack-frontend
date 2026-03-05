import { CONFIG } from 'src/global-config';

import { ProductBrandListView } from 'src/sections/product-brand/view';

const metadata = { title: `Marcas | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><ProductBrandListView /></>);
}
