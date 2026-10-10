import { CONFIG } from 'src/global-config';

import { SiteLinksView } from 'src/sections/site/view';

// ----------------------------------------------------------------------

const metadata = { title: `Links y eventos | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><SiteLinksView /></>);
}
