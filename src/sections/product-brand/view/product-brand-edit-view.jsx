import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { ProductBrandCreateEditForm } from '../product-brand-create-edit-form';

export function ProductBrandEditView({ brand }) {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar marca"
        backHref={paths.dashboard.productBrand.root}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Marcas', href: paths.dashboard.productBrand.root },
          { name: brand?.name },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <ProductBrandCreateEditForm currentBrand={brand} />
    </DashboardContent>
  );
}
