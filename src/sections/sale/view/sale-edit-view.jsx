import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { SaleCreateEditForm } from '../sale-create-edit-form';

// ----------------------------------------------------------------------

export function SaleEditView({ sale, saleDetails, salePayments }) {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar venta"
        backHref={paths.dashboard.sale.root}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Ventas', href: paths.dashboard.sale.root },
          { name: `Venta #${sale?.id ?? ''}` },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <SaleCreateEditForm
        currentSale={sale}
        currentDetails={saleDetails}
        currentPayments={salePayments}
      />
    </DashboardContent>
  );
}
