import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { ProductBatchCreateEditForm } from '../product-batch-create-edit-form';

// ----------------------------------------------------------------------

export function ProductBatchCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Nuevo lote / Stock"
        subheader="Selecciona el producto — el formulario se adapta automáticamente"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Lotes y Stock', href: paths.dashboard.productBatch.root },
          { name: 'Nuevo' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <ProductBatchCreateEditForm />
    </DashboardContent>
  );
}
