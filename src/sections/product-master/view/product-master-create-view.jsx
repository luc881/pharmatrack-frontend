import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { ProductMasterCreateEditForm } from '../product-master-create-edit-form';

// ----------------------------------------------------------------------

export function ProductMasterCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Nueva fórmula genérica"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Fórmulas genéricas', href: paths.dashboard.productMaster.root },
          { name: 'Nuevo' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <ProductMasterCreateEditForm />
    </DashboardContent>
  );
}
