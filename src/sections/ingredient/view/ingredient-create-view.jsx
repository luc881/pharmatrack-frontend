import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { IngredientCreateEditForm } from '../ingredient-create-edit-form';

// ----------------------------------------------------------------------

export function IngredientCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Nuevo ingrediente"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Ingredientes', href: paths.dashboard.ingredient.root },
          { name: 'Nuevo' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <IngredientCreateEditForm />
    </DashboardContent>
  );
}
