import { CONFIG } from 'src/global-config';

import { CultivosView } from 'src/sections/animal/view';

const metadata = { title: `Cultivos | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><CultivosView /></>);
}
