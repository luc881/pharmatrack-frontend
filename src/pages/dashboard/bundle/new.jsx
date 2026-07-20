import { CONFIG } from 'src/global-config';

import { BundleCreateView } from 'src/sections/bundle/view';

const metadata = { title: `Nuevo paquete | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><BundleCreateView /></>);
}
