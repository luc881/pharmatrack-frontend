import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { SaleCreateEditForm } from '../sale-create-edit-form';

// ----------------------------------------------------------------------

export function SaleCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Nueva venta"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Ventas', href: paths.dashboard.sale.root },
          { name: 'Nueva' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <SaleCreateEditForm />
    </DashboardContent>
  );
}
