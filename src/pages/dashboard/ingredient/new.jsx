import { CONFIG } from 'src/global-config';

import { IngredientCreateView } from 'src/sections/ingredient/view';

const metadata = { title: `Nuevo ingrediente | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><IngredientCreateView /></>);
}
