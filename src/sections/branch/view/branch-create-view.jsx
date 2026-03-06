import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { BranchCreateEditForm } from '../branch-create-edit-form';

// ----------------------------------------------------------------------

export function BranchCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Nueva sucursal"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Sucursales', href: paths.dashboard.branch.root },
          { name: 'Nueva' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <BranchCreateEditForm />
    </DashboardContent>
  );
}
