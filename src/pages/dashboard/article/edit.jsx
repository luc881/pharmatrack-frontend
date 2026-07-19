import { CONFIG } from 'src/global-config';

import { ArticleEditView } from 'src/sections/article/view';

const metadata = { title: `Editar artículo | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><ArticleEditView /></>);
}
