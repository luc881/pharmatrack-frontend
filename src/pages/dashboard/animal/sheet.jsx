import { CONFIG } from 'src/global-config';

import { InventorySheetView } from 'src/sections/animal/view';

const metadata = { title: `En venta: tabla de precios | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><InventorySheetView /></>);
}
