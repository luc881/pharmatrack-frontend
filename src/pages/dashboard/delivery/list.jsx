import { CONFIG } from 'src/global-config';

import { DeliveryListView } from 'src/sections/delivery/view';

const metadata = { title: `Entregas | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><DeliveryListView /></>);
}
