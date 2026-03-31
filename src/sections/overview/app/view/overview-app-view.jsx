import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';

import { DashboardContent } from 'src/layouts/dashboard';
import { useDashboardData } from 'src/actions/dashboard';
import { SeoIllustration } from 'src/assets/illustrations';

import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { AppWelcome } from '../app-welcome';
import { DashboardRecentSales } from '../dashboard-recent-sales';
import { DashboardExpiringBatches } from '../dashboard-expiring-batches';

// ----------------------------------------------------------------------

function StatCard({ title, value, icon, color = 'primary', loading }) {
  return (
    <Card sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box
        sx={{
          p: 1.5,
          flexShrink: 0,
          borderRadius: 1.5,
          display: 'flex',
          bgcolor: `${color}.lighter`,
        }}
      >
        <Iconify icon={icon} width={32} sx={{ color: `${color}.main` }} />
      </Box>

      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        {loading ? (
          <>
            <Skeleton variant="text" width={80} height={40} />
            <Skeleton variant="text" width={120} />
          </>
        ) : (
          <>
            <Typography variant="h4" noWrap>
              {value}
            </Typography>
            <Typography variant="subtitle2" color="text.secondary" noWrap>
              {title}
            </Typography>
          </>
        )}
      </Box>
    </Card>
  );
}

// ----------------------------------------------------------------------

export function OverviewAppView() {
  const { user } = useAuthContext();

  const { isLoading, monthlySalesCount, monthlyRevenue, totalProducts, expiringBatchesCount, recentSales, expiringBatches } =
    useDashboardData();

  return (
    <DashboardContent maxWidth="xl">
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <AppWelcome
            title={`Bienvenido de vuelta 👋\n${user?.sub ?? user?.email ?? ''}`}
            description="Aquí tienes un resumen del estado actual de la farmacia."
            img={<SeoIllustration hideBackground />}
            action={
              <Button
                component={RouterLink}
                href={paths.dashboard.sale.new}
                variant="contained"
                color="primary"
              >
                Nueva venta
              </Button>
            }
          />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <StatCard
            title="Lotes por vencer (≤30 días)"
            value={expiringBatchesCount}
            icon="solar:danger-triangle-bold"
            color="warning"
            loading={isLoading}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Ventas este mes"
            value={monthlySalesCount}
            icon="solar:cart-large-4-bold"
            color="primary"
            loading={isLoading}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Ingresos este mes"
            value={fCurrency(monthlyRevenue)}
            icon="solar:wallet-money-bold"
            color="success"
            loading={isLoading}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total productos"
            value={totalProducts}
            icon="solar:pills-bold"
            color="info"
            loading={isLoading}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Ir a lotes"
            value="Ver stock"
            icon="solar:box-bold"
            color="secondary"
            loading={false}
          />
        </Grid>

        <Grid size={{ xs: 12, lg: 8 }}>
          <DashboardRecentSales sales={recentSales} loading={isLoading} />
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <DashboardExpiringBatches batches={expiringBatches} loading={isLoading} />
        </Grid>
      </Grid>
    </DashboardContent>
  );
}
