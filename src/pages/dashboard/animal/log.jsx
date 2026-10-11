import { CONFIG } from 'src/global-config';

import { HusbandryLogView } from 'src/sections/animal/view';

const metadata = { title: `Bitácora de manejo | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>
      <HusbandryLogView />
    </>
  );
}
