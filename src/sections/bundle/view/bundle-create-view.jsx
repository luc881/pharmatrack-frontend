import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { BundleCreateEditForm } from '../bundle-create-edit-form';

// ----------------------------------------------------------------------

export function BundleCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Nuevo paquete"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Paquetes', href: paths.dashboard.bundle.root },
          { name: 'Nuevo' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <BundleCreateEditForm />
    </DashboardContent>
  );
}
