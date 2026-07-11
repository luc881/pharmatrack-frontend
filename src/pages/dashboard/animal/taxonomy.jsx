import { CONFIG } from 'src/global-config';

import { AnimalTaxonomyView } from 'src/sections/animal/view';

const metadata = { title: `Taxonomía | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><AnimalTaxonomyView /></>);
}
