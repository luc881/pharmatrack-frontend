import { CONFIG } from 'src/global-config';

import { ProductBatchCreateView } from 'src/sections/product-batch/view';

const metadata = { title: `Nuevo lote | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><ProductBatchCreateView /></>);
}
