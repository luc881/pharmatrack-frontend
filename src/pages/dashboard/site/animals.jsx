import { CONFIG } from 'src/global-config';

import { SiteAnimalsView } from 'src/sections/animal/view/site-animals-view';

// ----------------------------------------------------------------------

const metadata = { title: `Animales del sitio | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><SiteAnimalsView /></>);
}
