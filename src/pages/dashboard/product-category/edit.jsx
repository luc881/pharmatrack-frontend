import { useParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';
import { useGetProductCategory } from 'src/actions/product-category';

import { ProductCategoryEditView } from 'src/sections/product-category/view';

const metadata = { title: `Editar categoría | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  const { id = '' } = useParams();
  const { category } = useGetProductCategory(id);
  return (<><title>{metadata.title}</title><ProductCategoryEditView category={category} /></>);
}
