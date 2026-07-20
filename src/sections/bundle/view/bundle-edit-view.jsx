import { useParams } from 'react-router';

import { paths } from 'src/routes/paths';

import { useGetProduct } from 'src/actions/product';
import { DashboardContent } from 'src/layouts/dashboard';

import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { BundleCreateEditForm } from '../bundle-create-edit-form';

// ----------------------------------------------------------------------

export function BundleEditView() {
  const { id } = useParams();
  const { product, productLoading, productError } = useGetProduct(id);

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar paquete"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Paquetes', href: paths.dashboard.bundle.root },
          { name: product?.title ?? 'Editar' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      {productError ? (
        <EmptyContent title="No se encontró el paquete" />
      ) : (
        !productLoading && product && <BundleCreateEditForm currentBundle={product} />
      )}
    </DashboardContent>
  );
}
