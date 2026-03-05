import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { ProductCategoryCreateEditForm } from '../product-category-create-edit-form';

// ----------------------------------------------------------------------

export function ProductCategoryCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Nueva categoría"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Categorías', href: paths.dashboard.productCategory.root },
          { name: 'Nueva' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <ProductCategoryCreateEditForm />
    </DashboardContent>
  );
}
