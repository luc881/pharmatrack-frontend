import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';

import { DashboardContent } from 'src/layouts/dashboard';
import { useDashboardData } from 'src/actions/dashboard';
import { SeoIllustration } from 'src/assets/illustrations';

import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { AppWelcome } from '../app-welcome';
import { SensorWidget } from '../sensor-widget';
import { DashboardRecentSales } from '../dashboard-recent-sales';
import { DashboardExpiringBatches } from '../dashboard-expiring-batches';

// ----------------------------------------------------------------------

function QuickActionCard({ title, description, icon, color = 'primary', href }) {
  const theme = useTheme();
  return (
    <Card
      component={RouterLink}
      href={href}
      sx={{
        p: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        textDecoration: 'none',
        transition: theme.transitions.create(['box-shadow', 'transform'], { duration: 200 }),
        '&:hover': {
          boxShadow: theme.customShadows?.z8 ?? theme.shadows[4],
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Box
        sx={{
          p: 1.25,
          flexShrink: 0,
          borderRadius: 1.5,
          display: 'flex',
          bgcolor: (t) => alpha(t.palette[color].main, 0.12),
        }}
      >
        <Iconify icon={icon} width={26} sx={{ color: `${color}.main` }} />
      </Box>

      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="subtitle2" noWrap sx={{ color: 'text.primary' }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.4 }}>
            {description}
          </Typography>
        )}
      </Box>

      <Iconify icon="eva:arrow-ios-forward-fill" width={18} sx={{ color: 'text.disabled', flexShrink: 0 }} />
    </Card>
  );
}

// ----------------------------------------------------------------------

function QuickActions({ isAdmin }) {
  const allActions = [
    {
      title: 'Nueva venta',
      description: 'Registrar venta',
      icon: 'solar:cart-plus-bold-duotone',
      color: 'primary',
      href: paths.dashboard.sale.new,
      adminOnly: false,
    },
    {
      title: 'Ver ventas',
      description: 'Historial de ventas',
      icon: 'solar:bill-list-bold-duotone',
      color: 'info',
      href: paths.dashboard.sale.root,
      adminOnly: false,
    },
    {
      title: 'Ver productos',
      description: 'Catálogo de productos',
      icon: 'solar:pills-bold-duotone',
      color: 'success',
      href: paths.dashboard.product.root,
      adminOnly: false,
    },
    {
      title: 'Ver lotes',
      description: 'Stock y fechas de vencimiento',
      icon: 'solar:box-bold-duotone',
      color: 'warning',
      href: paths.dashboard.productBatch.root,
      adminOnly: false,
    },
    {
      title: 'Nueva compra',
      description: 'Registrar compra a proveedor',
      icon: 'solar:bag-2-bold-duotone',
      color: 'secondary',
      href: paths.dashboard.purchase.new,
      adminOnly: true,
    },
    {
      title: 'Ver compras',
      description: 'Historial de compras',
      icon: 'solar:bag-smile-bold-duotone',
      color: 'secondary',
      href: paths.dashboard.purchase.root,
      adminOnly: true,
    },
    {
      title: 'Nuevo producto',
      description: 'Agregar al catálogo',
      icon: 'solar:add-circle-bold-duotone',
      color: 'success',
      href: paths.dashboard.product.new,
      adminOnly: true,
    },
    {
      title: 'Nuevo lote',
      description: 'Ingresar stock',
      icon: 'solar:inbox-in-bold-duotone',
      color: 'warning',
      href: paths.dashboard.productBatch.new,
      adminOnly: false,
    },
    {
      title: 'Nueva devolución',
      description: 'Registrar devolución',
      icon: 'solar:arrow-left-down-bold-duotone',
      color: 'error',
      href: paths.dashboard.refundProduct.new,
      adminOnly: false,
    },
    {
      title: 'Ver devoluciones',
      description: 'Historial de devoluciones',
      icon: 'solar:archive-down-minimlistic-bold-duotone',
      color: 'error',
      href: paths.dashboard.refundProduct.root,
      adminOnly: false,
    },
    {
      title: 'Calendario',
      description: 'Vencimientos por fecha',
      icon: 'solar:calendar-bold-duotone',
      color: 'info',
      href: paths.dashboard.calendar,
      adminOnly: false,
    },
    {
      title: 'Ver proveedores',
      description: 'Gestión de proveedores',
      icon: 'solar:truck-bold-duotone',
      color: 'secondary',
      href: paths.dashboard.supplier.root,
      adminOnly: true,
    },
    {
      title: 'Ver usuarios',
      description: 'Gestión de equipo',
      icon: 'solar:users-group-rounded-bold-duotone',
      color: 'primary',
      href: paths.dashboard.user.root,
      adminOnly: true,
    },
  ];

  const actions = allActions.filter((a) => !a.adminOnly || isAdmin);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Acciones rápidas
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: 'repeat(1, 1fr)',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
            xl: 'repeat(4, 1fr)',
          },
        }}
      >
        {actions.map((action) => (
          <QuickActionCard key={action.href} {...action} />
        ))}
      </Box>
    </Box>
  );
}

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

  const { isLoading, monthlySalesCount, monthlyRevenue, totalProducts, expiringBatchesCount, expiredBatchesCount, recentSales, expiringBatches } =
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
            title="Lotes vencidos"
            value={expiredBatchesCount}
            icon="solar:danger-circle-bold"
            color="error"
            loading={isLoading}
          />
        </Grid>

        {/* Acciones rápidas + Sensor (misma fila en desktop) */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <QuickActions isAdmin={(user?.permissions ?? []).includes('users.read')} />
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <SensorWidget />
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
