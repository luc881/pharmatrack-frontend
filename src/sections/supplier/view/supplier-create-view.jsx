import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { SupplierCreateEditForm } from '../supplier-create-edit-form';

// ----------------------------------------------------------------------

export function SupplierCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Nuevo proveedor"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Proveedores', href: paths.dashboard.supplier.root },
          { name: 'Nuevo' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <SupplierCreateEditForm />
    </DashboardContent>
  );
}
