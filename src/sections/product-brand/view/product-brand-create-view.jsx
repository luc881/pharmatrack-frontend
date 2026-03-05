import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { ProductBrandCreateEditForm } from '../product-brand-create-edit-form';

export function ProductBrandCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Nueva marca"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Marcas', href: paths.dashboard.productBrand.root },
          { name: 'Nueva' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <ProductBrandCreateEditForm />
    </DashboardContent>
  );
}
