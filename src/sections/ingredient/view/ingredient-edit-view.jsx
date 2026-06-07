import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { IngredientCreateEditForm } from '../ingredient-create-edit-form';

// ----------------------------------------------------------------------

export function IngredientEditView({ currentIngredient }) {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar sustancia"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Sustancias', href: paths.dashboard.ingredient.root },
          { name: currentIngredient?.name ?? 'Editar' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <IngredientCreateEditForm currentIngredient={currentIngredient} />
    </DashboardContent>
  );
}
