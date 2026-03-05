import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { PurchaseCreateEditForm } from '../purchase-create-edit-form';

// ----------------------------------------------------------------------

export function PurchaseEditView({ purchase, purchaseDetails }) {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar compra"
        backHref={paths.dashboard.purchase.root}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Compras', href: paths.dashboard.purchase.root },
          { name: `Compra #${purchase?.id ?? ''}` },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <PurchaseCreateEditForm currentPurchase={purchase} currentDetails={purchaseDetails} />
    </DashboardContent>
  );
}
