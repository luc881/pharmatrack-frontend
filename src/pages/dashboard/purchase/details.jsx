import { useParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';
import { useGetPurchase } from 'src/actions/purchase';

import { PurchaseDetailView } from 'src/sections/purchase/view';

const metadata = { title: `Detalle de compra | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  const { id } = useParams();
  const { purchase } = useGetPurchase(id);
  return (<><title>{metadata.title}</title><PurchaseDetailView currentPurchase={purchase} /></>);
}
