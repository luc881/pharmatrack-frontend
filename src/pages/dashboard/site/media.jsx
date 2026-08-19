import { CONFIG } from 'src/global-config';

import { SiteMediaView } from 'src/sections/site/view';

// ----------------------------------------------------------------------

const metadata = { title: `Media del sitio | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><SiteMediaView /></>);
}
