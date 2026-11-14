import { useParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';

import { QuickSaleTicketView } from 'src/sections/quick-sale/view/quick-sale-ticket-view';

// ----------------------------------------------------------------------

export default function Page() {
  const { key } = useParams();
  return (
    <>
      <title>{`Ticket de venta rápida | ${CONFIG.appName}`}</title>
      <QuickSaleTicketView saleKey={key} />
    </>
  );
}
