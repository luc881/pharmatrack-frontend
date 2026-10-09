import { CONFIG } from 'src/global-config';

import { InventorySheetView } from 'src/sections/animal/view';

const metadata = { title: `Hoja de inventario | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><InventorySheetView /></>);
}
