import { CONFIG } from 'src/global-config';

import { ProductCategoryCreateView } from 'src/sections/product-category/view';

const metadata = { title: `Nueva categoría | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><ProductCategoryCreateView /></>);
}
