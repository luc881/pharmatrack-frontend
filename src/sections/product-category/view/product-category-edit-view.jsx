import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { ProductCategoryCreateEditForm } from '../product-category-create-edit-form';

// ----------------------------------------------------------------------

export function ProductCategoryEditView({ category }) {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar categoría"
        backHref={paths.dashboard.productCategory.root}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Categorías', href: paths.dashboard.productCategory.root },
          { name: category?.name },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <ProductCategoryCreateEditForm currentCategory={category} />
    </DashboardContent>
  );
}
