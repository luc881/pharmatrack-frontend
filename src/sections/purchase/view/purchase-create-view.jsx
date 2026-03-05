import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { PurchaseCreateEditForm } from '../purchase-create-edit-form';

// ----------------------------------------------------------------------

export function PurchaseCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Nueva compra"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Compras', href: paths.dashboard.purchase.root },
          { name: 'Nueva' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <PurchaseCreateEditForm />
    </DashboardContent>
  );
}
