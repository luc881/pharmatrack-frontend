import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { RoleCreateEditForm } from '../role-create-edit-form';

// ----------------------------------------------------------------------

export function RoleEditView({ role }) {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar rol"
        backHref={paths.dashboard.role.root}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Roles', href: paths.dashboard.role.root },
          { name: role?.name },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <RoleCreateEditForm currentRole={role} />
    </DashboardContent>
  );
}
