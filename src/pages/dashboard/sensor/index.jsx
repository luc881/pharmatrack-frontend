import { CONFIG } from 'src/global-config';

import { SensorConfigView } from 'src/sections/sensor-config/view';

// ----------------------------------------------------------------------

const metadata = { title: `Sensor | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>

      <SensorConfigView />
    </>
  );
}
