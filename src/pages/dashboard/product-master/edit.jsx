import { useParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';
import { useGetProductMaster } from 'src/actions/product-master';

import { ProductMasterEditView } from 'src/sections/product-master/view';

const metadata = { title: `Editar principio activo | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  const { id = '' } = useParams();
  const { productMaster } = useGetProductMaster(id);
  return (<><title>{metadata.title}</title><ProductMasterEditView productMaster={productMaster} /></>);
}
