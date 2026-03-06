import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { ProductMasterCreateEditForm } from '../product-master-create-edit-form';

// ----------------------------------------------------------------------

export function ProductMasterEditView({ productMaster }) {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar principio activo"
        backHref={paths.dashboard.productMaster.root}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Principios activos', href: paths.dashboard.productMaster.root },
          { name: productMaster?.name },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <ProductMasterCreateEditForm currentProductMaster={productMaster} />
    </DashboardContent>
  );
}
