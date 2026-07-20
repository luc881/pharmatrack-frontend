import { CONFIG } from 'src/global-config';

import { BundleEditView } from 'src/sections/bundle/view';

const metadata = { title: `Editar paquete | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><BundleEditView /></>);
}
