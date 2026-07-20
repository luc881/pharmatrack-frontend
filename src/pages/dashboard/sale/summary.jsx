import { CONFIG } from 'src/global-config';

import { SaleSummaryView } from 'src/sections/sale/view';

const metadata = { title: `Corte de caja | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><SaleSummaryView /></>);
}
