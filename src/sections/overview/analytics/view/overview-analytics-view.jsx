import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { CONFIG } from 'src/global-config';
import { DashboardContent } from 'src/layouts/dashboard';
import { useGetDashboardStats } from 'src/actions/dashboard';

import { AnalyticsCurrentVisits } from '../analytics-current-visits';
import { AnalyticsWebsiteVisits } from '../analytics-website-visits';
import { AnalyticsWidgetSummary } from '../analytics-widget-summary';
import { AnalyticsConversionRates } from '../analytics-conversion-rates';

// ----------------------------------------------------------------------

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const PAYMENT_LABELS = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' };

function monthLabel(yyyymm) {
  const mm = parseInt(yyyymm.split('-')[1], 10);
  return MONTH_SHORT[mm - 1];
}

function calcPercent(current, previous) {
  if (!previous || previous === 0) return 0;
  return parseFloat((((current - previous) / previous) * 100).toFixed(1));
}

// ----------------------------------------------------------------------

export function OverviewAnalyticsView() {
  const { stats, statsLoading } = useGetDashboardStats();

  if (statsLoading || !stats) {
    return (
      <DashboardContent maxWidth="xl">
        <Typography variant="h4" sx={{ mb: { xs: 3, md: 5 } }}>
          Estadísticas
        </Typography>
        <Grid container spacing={3}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
              <Skeleton variant="rounded" height={160} />
            </Grid>
          ))}
        </Grid>
      </DashboardContent>
    );
  }

  // ── KPI data ──────────────────────────────────────────────────────────────
  const { current_month, previous_month } = stats.monthly_comparison;

  const revenuePercent = calcPercent(current_month.revenue, previous_month.revenue);
  const countPercent   = calcPercent(current_month.count, previous_month.count);

  const last7months     = stats.sales_by_month.slice(-7);
  const sparkCategories = last7months.map((m) => monthLabel(m.month));
  const sparkRevenue    = last7months.map((m) => Math.round(m.revenue));
  const sparkCount      = last7months.map((m) => m.count);

  // ── Sales by month chart ──────────────────────────────────────────────────
  const allMonths    = stats.sales_by_month.map((m) => monthLabel(m.month));
  const allRevenue   = stats.sales_by_month.map((m) => Math.round(m.revenue));
  const allCount     = stats.sales_by_month.map((m) => m.count);

  // ── Payment methods pie ───────────────────────────────────────────────────
  const paymentSeries = stats.payment_methods.map((p) => ({
    label: PAYMENT_LABELS[p.method] ?? p.method,
    value: p.count,
  }));

  // ── Top products horizontal bar ───────────────────────────────────────────
  const topCategories = stats.top_products.map((p) =>
    p.title.length > 20 ? `${p.title.slice(0, 20)}…` : p.title
  );
  const topQuantities = stats.top_products.map((p) => Math.round(p.quantity_sold));
  const topRevenues   = stats.top_products.map((p) => Math.round(p.revenue));

  return (
    <DashboardContent maxWidth="xl">
      <Typography variant="h4" sx={{ mb: { xs: 3, md: 5 } }}>
        Estadísticas
      </Typography>

      <Grid container spacing={3}>
        {/* KPI — Ingresos del mes */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AnalyticsWidgetSummary
            title="Ingresos este mes"
            percent={revenuePercent}
            total={Math.round(current_month.revenue)}
            color="primary"
            icon={<img alt="ingresos" src={`${CONFIG.assetsDir}/assets/icons/glass/ic-glass-bag.svg`} />}
            chart={{ categories: sparkCategories, series: sparkRevenue }}
          />
        </Grid>

        {/* KPI — Ventas del mes */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AnalyticsWidgetSummary
            title="Ventas este mes"
            percent={countPercent}
            total={current_month.count}
            color="secondary"
            icon={<img alt="ventas" src={`${CONFIG.assetsDir}/assets/icons/glass/ic-glass-buy.svg`} />}
            chart={{ categories: sparkCategories, series: sparkCount }}
          />
        </Grid>

        {/* KPI — Lotes por vencer */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AnalyticsWidgetSummary
            title="Lotes por vencer (≤30d)"
            percent={0}
            total={stats.expiring_soon}
            color="warning"
            icon={<img alt="vencer" src={`${CONFIG.assetsDir}/assets/icons/glass/ic-glass-message.svg`} />}
            chart={{ categories: sparkCategories, series: sparkCategories.map(() => 0) }}
          />
        </Grid>

        {/* KPI — Lotes bajo stock */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AnalyticsWidgetSummary
            title="Lotes con bajo stock"
            percent={0}
            total={stats.low_stock_batches}
            color="error"
            icon={<img alt="stock" src={`${CONFIG.assetsDir}/assets/icons/glass/ic-glass-users.svg`} />}
            chart={{ categories: sparkCategories, series: sparkCategories.map(() => 0) }}
          />
        </Grid>

        {/* Métodos de pago */}
        <Grid size={{ xs: 12, md: 4 }}>
          <AnalyticsCurrentVisits
            title="Métodos de pago"
            subheader="Por número de transacciones"
            chart={{ series: paymentSeries }}
          />
        </Grid>

        {/* Ventas e ingresos por mes */}
        <Grid size={{ xs: 12, md: 8 }}>
          <AnalyticsWebsiteVisits
            title="Ventas e ingresos por mes"
            subheader="Últimos 12 meses"
            chart={{
              categories: allMonths,
              series: [
                { name: 'Ingresos ($)', data: allRevenue },
                { name: 'N° ventas', data: allCount },
              ],
            }}
          />
        </Grid>

        {/* Top 10 productos */}
        <Grid size={{ xs: 12 }}>
          <AnalyticsConversionRates
            title="Top 10 productos más vendidos"
            subheader="Por cantidad de unidades"
            chart={{
              categories: topCategories,
              series: [
                { name: 'Unidades vendidas', data: topQuantities },
                { name: 'Ingresos ($)',       data: topRevenues },
              ],
            }}
          />
        </Grid>
      </Grid>
    </DashboardContent>
  );
}
