import { CONFIG } from 'src/global-config';

import { ProductMasterCreateView } from 'src/sections/product-master/view';

const metadata = { title: `Nuevo principio activo | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><ProductMasterCreateView /></>);
}
