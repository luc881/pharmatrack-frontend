import { CONFIG } from 'src/global-config';

import { EmailTemplateView } from 'src/sections/sale/view';

const metadata = { title: `Correo de ticket | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><EmailTemplateView /></>);
}
