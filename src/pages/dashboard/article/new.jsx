import { CONFIG } from 'src/global-config';

import { ArticleCreateView } from 'src/sections/article/view';

const metadata = { title: `Nuevo artículo | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><ArticleCreateView /></>);
}
