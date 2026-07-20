import { CONFIG } from 'src/global-config';

import { BundleListView } from 'src/sections/bundle/view';

const metadata = { title: `Paquetes | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><BundleListView /></>);
}
