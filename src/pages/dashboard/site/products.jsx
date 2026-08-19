import { CONFIG } from 'src/global-config';

import { ProductOnlineView } from 'src/sections/product/view';

// ----------------------------------------------------------------------

const metadata = { title: `Productos del sitio | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><ProductOnlineView /></>);
}
