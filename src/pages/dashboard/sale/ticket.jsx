import { useParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';

import { SaleTicketView } from 'src/sections/sale/view/sale-ticket-view';

// Sin :id (ruta /sale/ticket-prueba) muestra el ticket de prueba
export default function Page() {
  const { id } = useParams();
  return (
    <>
      <title>{`${id ? `Ticket #${id}` : 'Ticket de prueba'} | ${CONFIG.appName}`}</title>
      <SaleTicketView saleId={id} />
    </>
  );
}
