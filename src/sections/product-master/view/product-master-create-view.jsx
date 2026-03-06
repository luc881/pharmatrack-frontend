import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { ProductMasterCreateEditForm } from '../product-master-create-edit-form';

// ----------------------------------------------------------------------

export function ProductMasterCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Nuevo principio activo"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Principios activos', href: paths.dashboard.productMaster.root },
          { name: 'Nuevo' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <ProductMasterCreateEditForm />
    </DashboardContent>
  );
}
