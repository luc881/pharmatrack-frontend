import { useParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';
import { useGetProductBrand } from 'src/actions/product-brand';

import { ProductBrandEditView } from 'src/sections/product-brand/view';

const metadata = { title: `Editar marca | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  const { id = '' } = useParams();
  const { brand } = useGetProductBrand(id);
  return (<><title>{metadata.title}</title><ProductBrandEditView brand={brand} /></>);
}
