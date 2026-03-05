import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { RoleCreateEditForm } from '../role-create-edit-form';

// ----------------------------------------------------------------------

export function RoleCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Nuevo rol"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Roles', href: paths.dashboard.role.root },
          { name: 'Nuevo' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <RoleCreateEditForm />
    </DashboardContent>
  );
}
