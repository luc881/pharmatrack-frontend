import { CONFIG } from 'src/global-config';

import { ProductMasterListView } from 'src/sections/product-master/view';

const metadata = { title: `Principios activos | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><ProductMasterListView /></>);
}
