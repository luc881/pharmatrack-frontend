import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { AnimalCreateEditForm } from '../animal-create-edit-form';

// ----------------------------------------------------------------------

export function AnimalCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Nuevo animal"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Animales', href: paths.dashboard.animal.root },
          { name: 'Nuevo' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <AnimalCreateEditForm />
    </DashboardContent>
  );
}
