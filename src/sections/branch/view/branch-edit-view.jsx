import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { BranchCreateEditForm } from '../branch-create-edit-form';

// ----------------------------------------------------------------------

export function BranchEditView({ branch }) {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar sucursal"
        backHref={paths.dashboard.branch.root}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Sucursales', href: paths.dashboard.branch.root },
          { name: branch?.name },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <BranchCreateEditForm currentBranch={branch} />
    </DashboardContent>
  );
}
