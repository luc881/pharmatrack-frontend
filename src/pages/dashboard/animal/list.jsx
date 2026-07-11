import { CONFIG } from 'src/global-config';

import { AnimalListView } from 'src/sections/animal/view';

const metadata = { title: `Animales | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><AnimalListView /></>);
}
