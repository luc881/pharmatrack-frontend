import { CONFIG } from 'src/global-config';

import { AnimalListView } from 'src/sections/animal/view';

const metadata = { title: `Animales en venta | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><AnimalListView area="sale" /></>);
}
