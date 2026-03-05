import { useParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';
import { useGetProductBatch } from 'src/actions/product-batch';

import { ProductBatchEditView } from 'src/sections/product-batch/view';

const metadata = { title: `Editar lote | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  const { id = '' } = useParams();
  const { batch } = useGetProductBatch(id);
  return (<><title>{metadata.title}</title><ProductBatchEditView batch={batch} /></>);
}
