import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { SupplierCreateEditForm } from '../supplier-create-edit-form';

// ----------------------------------------------------------------------

export function SupplierEditView({ supplier }) {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar proveedor"
        backHref={paths.dashboard.supplier.root}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Proveedores', href: paths.dashboard.supplier.root },
          { name: supplier?.name },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <SupplierCreateEditForm currentSupplier={supplier} />
    </DashboardContent>
  );
}
