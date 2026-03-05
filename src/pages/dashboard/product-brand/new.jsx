import { CONFIG } from 'src/global-config';

import { ProductBrandCreateView } from 'src/sections/product-brand/view';

const metadata = { title: `Nueva marca | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><ProductBrandCreateView /></>);
}
