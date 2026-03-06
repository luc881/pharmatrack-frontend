import { CONFIG } from 'src/global-config';

import { BranchCreateView } from 'src/sections/branch/view';

const metadata = { title: `Nueva sucursal | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><BranchCreateView /></>);
}
