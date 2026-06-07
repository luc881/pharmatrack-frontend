import { CONFIG } from 'src/global-config';

import { IngredientListView } from 'src/sections/ingredient/view';

const metadata = { title: `Sustancias | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><IngredientListView /></>);
}
