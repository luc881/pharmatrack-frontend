import { CONFIG } from 'src/global-config';

import { ArticleListView } from 'src/sections/article/view';

const metadata = { title: `Artículos | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (<><title>{metadata.title}</title><ArticleListView /></>);
}
