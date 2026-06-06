import { useParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';
import {
  useGetSale,
  useGetSaleDetails,
  useGetSalePayments,
  useGetSaleBatchUsagesBySale,
} from 'src/actions/sale';

import { SaleEditView } from 'src/sections/sale/view';

// ----------------------------------------------------------------------

const metadata = { title: `Editar venta | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  const { id = '' } = useParams();

  const { sale } = useGetSale(id);
  const { saleDetails } = useGetSaleDetails(id);
  const { salePayments } = useGetSalePayments(id);
  const { saleBatchUsages, saleBatchUsagesLoading } = useGetSaleBatchUsagesBySale(id);

  return (
    <>
      <title>{metadata.title}</title>
      <SaleEditView
        sale={sale}
        saleDetails={saleDetails}
        salePayments={salePayments}
        saleBatchUsages={saleBatchUsages}
        saleBatchUsagesLoading={saleBatchUsagesLoading}
      />
    </>
  );
}
