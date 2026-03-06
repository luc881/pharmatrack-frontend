import { useParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';
import { useGetSale } from 'src/actions/sale';

import { SaleDetailView } from 'src/sections/sale/view';

const metadata = { title: `Detalle de venta | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  const { id } = useParams();
  const { sale } = useGetSale(id);
  return (<><title>{metadata.title}</title><SaleDetailView currentSale={sale} /></>);
}
