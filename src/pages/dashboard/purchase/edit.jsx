import { useParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';
import { useGetPurchase, useGetPurchaseDetails } from 'src/actions/purchase';

import { PurchaseEditView } from 'src/sections/purchase/view';

// ----------------------------------------------------------------------

const metadata = { title: `Editar compra | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  const { id = '' } = useParams();

  const { purchase } = useGetPurchase(id);
  const { purchaseDetails } = useGetPurchaseDetails(id);

  return (
    <>
      <title>{metadata.title}</title>
      <PurchaseEditView purchase={purchase} purchaseDetails={purchaseDetails} />
    </>
  );
}
