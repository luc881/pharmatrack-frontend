import { CONFIG } from 'src/global-config';

import { ProductCategoryListView } from 'src/sections/product-category/view';

const metadata = { title: `Categorías | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><ProductCategoryListView /></>);
}
