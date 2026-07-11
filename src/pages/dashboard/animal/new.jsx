import { CONFIG } from 'src/global-config';

import { AnimalCreateView } from 'src/sections/animal/view';

const metadata = { title: `Nuevo animal | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><AnimalCreateView /></>);
}
