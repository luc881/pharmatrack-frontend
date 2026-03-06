import { CONFIG } from 'src/global-config';

import { BranchListView } from 'src/sections/branch/view';

const metadata = { title: `Sucursales | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><BranchListView /></>);
}
