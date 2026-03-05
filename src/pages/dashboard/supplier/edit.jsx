import { useParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';
import { useGetSupplier } from 'src/actions/supplier';

import { SupplierEditView } from 'src/sections/supplier/view';

// ----------------------------------------------------------------------

const metadata = { title: `Editar proveedor | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  const { id = '' } = useParams();

  const { supplier } = useGetSupplier(id);

  return (
    <>
      <title>{metadata.title}</title>
      <SupplierEditView supplier={supplier} />
    </>
  );
}
