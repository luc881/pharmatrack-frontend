import { CONFIG } from 'src/global-config';

import { ProductProvisionalView } from 'src/sections/product/view/product-provisional-view';

// ----------------------------------------------------------------------

const metadata = { title: `Productos por revisar | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>

      <ProductProvisionalView />
    </>
  );
}
