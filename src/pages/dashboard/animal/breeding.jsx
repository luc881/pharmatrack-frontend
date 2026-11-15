import { CONFIG } from 'src/global-config';

import { AnimalListView } from 'src/sections/animal/view';

const metadata = { title: `Pie de cría y crianza | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><AnimalListView area="breeding" /></>);
}
