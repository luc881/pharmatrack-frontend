import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { RefundProductCreateForm } from '../refund-product-create-form';

// ----------------------------------------------------------------------

export function RefundProductCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Nueva devolución"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Devoluciones', href: paths.dashboard.refundProduct.root },
          { name: 'Nueva' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <RefundProductCreateForm />
    </DashboardContent>
  );
}
