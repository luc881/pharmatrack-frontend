import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { ProductBatchCreateEditForm } from '../product-batch-create-edit-form';

// ----------------------------------------------------------------------

export function ProductBatchEditView({ batch }) {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar lote / Stock"
        backHref={paths.dashboard.productBatch.root}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Lotes y Stock', href: paths.dashboard.productBatch.root },
          { name: batch?.lot_code ?? `#${batch?.id ?? ''}` },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <ProductBatchCreateEditForm currentBatch={batch} />
    </DashboardContent>
  );
}
