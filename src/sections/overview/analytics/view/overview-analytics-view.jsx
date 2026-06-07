import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { CONFIG } from 'src/global-config';
import { DashboardContent } from 'src/layouts/dashboard';
import { useGetDashboardStats } from 'src/actions/dashboard';

import { AnalyticsCurrentVisits } from '../analytics-current-visits';
import { AnalyticsProfitTrend } from '../analytics-profit-trend';
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
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
              <Skeleton variant="rounded" height={160} />
            </Grid>
          ))}
        </Grid>
      </DashboardContent>
    );
  }

  // ── Monthly comparison ────────────────────────────────────────────────────
  const { current_month, previous_month } = stats.monthly_comparison;

  const revenuePercent = calcPercent(current_month.revenue, previous_month.revenue);
  const countPercent   = calcPercent(current_month.count,   previous_month.count);
  const profitPercent  = calcPercent(current_month.profit ?? 0, previous_month.profit ?? 0);

  const currentMargin  = current_month.revenue > 0
    ? parseFloat(((current_month.profit ?? 0) / current_month.revenue * 100).toFixed(1))
    : 0;
  const previousMargin = previous_month.revenue > 0
    ? parseFloat(((previous_month.profit ?? 0) / previous_month.revenue * 100).toFixed(1))
    : 0;
  const marginPercent  = calcPercent(currentMargin, previousMargin);

  // ── Sparklines (last 7 months) ────────────────────────────────────────────
  const last7          = stats.sales_by_month.slice(-7);
  const sparkCats      = last7.map((m) => monthLabel(m.month));
  const sparkRevenue   = last7.map((m) => Math.round(m.revenue));
  const sparkCount     = last7.map((m) => m.count);
  const sparkProfit    = last7.map((m) => Math.round(m.profit ?? 0));
  const sparkMargin    = last7.map((m) =>
    m.revenue > 0 ? Math.round(((m.profit ?? 0) / m.revenue) * 100) : 0
  );

  // ── Profit trend area chart (all months) ─────────────────────────────────
  const allMonths  = stats.sales_by_month.map((m) => monthLabel(m.month));
  const allRevenue = stats.sales_by_month.map((m) => Math.round(m.revenue));
  const allCosts   = stats.sales_by_month.map((m) => Math.round(m.cost ?? 0));
  const allProfits = stats.sales_by_month.map((m) => Math.round(m.profit ?? 0));

  // ── Monthly sales bar (count) ─────────────────────────────────────────────
  const allCount = stats.sales_by_month.map((m) => m.count);

  // ── Payment methods ───────────────────────────────────────────────────────
  const paymentSeries = stats.payment_methods.map((p) => ({
    label: PAYMENT_LABELS[p.method] ?? p.method,
    value: p.count,
  }));

  // ── Sales by category ─────────────────────────────────────────────────────
  const categorySeries = (stats.sales_by_category ?? []).map((c) => ({
    label: c.category || 'Sin categoría',
    value: Math.round(c.revenue),
  }));

  // ── Sales by branch ───────────────────────────────────────────────────────
  const branchData       = stats.sales_by_branch ?? [];
  const showBranchChart  = branchData.length > 1;
  const branchCategories = branchData.map((b) => b.branch);
  const branchRevenue    = branchData.map((b) => Math.round(b.revenue));
  const branchCount      = branchData.map((b) => b.count);

  // ── Top products ──────────────────────────────────────────────────────────
  const topLabels     = stats.top_products.map((p) =>
    p.title.length > 22 ? `${p.title.slice(0, 22)}…` : p.title
  );
  const topQuantities = stats.top_products.map((p) => Math.round(p.quantity_sold));
  const topProfits    = stats.top_products.map((p) => Math.round(p.profit ?? 0));

  return (
    <DashboardContent maxWidth="xl">
      <Typography variant="h4" sx={{ mb: { xs: 3, md: 5 } }}>
        Estadísticas
      </Typography>

      <Grid container spacing={3}>

        {/* ── KPI Row 1 — Financiero ──────────────────────────────────────── */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AnalyticsWidgetSummary
            title="Ingresos este mes"
            percent={revenuePercent}
            total={Math.round(current_month.revenue)}
            color="primary"
            icon={<img alt="ingresos" src={`${CONFIG.assetsDir}/assets/icons/glass/ic-glass-bag.svg`} />}
            chart={{ categories: sparkCats, series: sparkRevenue }}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AnalyticsWidgetSummary
            title="Ganancia este mes"
            percent={profitPercent}
            total={Math.round(current_month.profit ?? 0)}
            color="success"
            icon={<img alt="ganancia" src={`${CONFIG.assetsDir}/assets/icons/glass/ic-glass-bag.svg`} />}
            chart={{ categories: sparkCats, series: sparkProfit }}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AnalyticsWidgetSummary
            title="Ventas este mes"
            percent={countPercent}
            total={current_month.count}
            color="secondary"
            icon={<img alt="ventas" src={`${CONFIG.assetsDir}/assets/icons/glass/ic-glass-buy.svg`} />}
            chart={{ categories: sparkCats, series: sparkCount }}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AnalyticsWidgetSummary
            title="Margen este mes (%)"
            percent={marginPercent}
            total={currentMargin}
            color="info"
            icon={<img alt="margen" src={`${CONFIG.assetsDir}/assets/icons/glass/ic-glass-buy.svg`} />}
            chart={{ categories: sparkCats, series: sparkMargin }}
          />
        </Grid>

        {/* ── KPI Row 2 — Inventario ──────────────────────────────────────── */}
        <Grid size={{ xs: 12, sm: 4 }}>
          <AnalyticsWidgetSummary
            title="Lotes por vencer (≤30d)"
            percent={0}
            total={stats.expiring_soon}
            color="warning"
            icon={<img alt="vencer" src={`${CONFIG.assetsDir}/assets/icons/glass/ic-glass-message.svg`} />}
            chart={{ categories: sparkCats, series: sparkCats.map(() => 0) }}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <AnalyticsWidgetSummary
            title="Lotes vencidos"
            percent={0}
            total={stats.expired_batches ?? 0}
            color="error"
            icon={<img alt="vencidos" src={`${CONFIG.assetsDir}/assets/icons/glass/ic-glass-message.svg`} />}
            chart={{ categories: sparkCats, series: sparkCats.map(() => 0) }}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <AnalyticsWidgetSummary
            title="Lotes con bajo stock"
            percent={0}
            total={stats.low_stock_batches}
            color="error"
            icon={<img alt="stock" src={`${CONFIG.assetsDir}/assets/icons/glass/ic-glass-users.svg`} />}
            chart={{ categories: sparkCats, series: sparkCats.map(() => 0) }}
          />
        </Grid>

        {/* ── Tendencia financiera ────────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 8 }}>
          <AnalyticsProfitTrend
            title="Tendencia financiera"
            subheader="Ingresos, costos y ganancia — últimos 12 meses"
            chart={{
              categories: allMonths,
              series: [
                { name: 'Ingresos ($)',  data: allRevenue },
                { name: 'Costo ($)',     data: allCosts   },
                { name: 'Ganancia ($)', data: allProfits  },
              ],
            }}
          />
        </Grid>

        {/* ── Métodos de pago ─────────────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 4 }}>
          <AnalyticsCurrentVisits
            title="Métodos de pago"
            subheader="Por número de transacciones"
            chart={{ series: paymentSeries }}
          />
        </Grid>

        {/* ── Ventas por categoría ────────────────────────────────────────── */}
        {categorySeries.length > 0 && (
          <Grid size={{ xs: 12, md: 4 }}>
            <AnalyticsCurrentVisits
              title="Ventas por categoría"
              subheader="Ingresos por categoría — últimos 12 meses"
              chart={{ series: categorySeries }}
            />
          </Grid>
        )}

        {/* ── Ventas por sucursal (solo si hay más de una) ─────────────────── */}
        {showBranchChart && (
          <Grid size={{ xs: 12, md: categorySeries.length > 0 ? 8 : 12 }}>
            <AnalyticsWebsiteVisits
              title="Ventas por sucursal"
              subheader="Ingresos y número de ventas — últimos 12 meses"
              chart={{
                categories: branchCategories,
                series: [
                  { name: 'Ingresos ($)', data: branchRevenue },
                  { name: 'N° ventas',    data: branchCount   },
                ],
              }}
            />
          </Grid>
        )}

        {/* ── N° ventas por mes (si no hay gráfica de sucursales) ─────────── */}
        {!showBranchChart && (
          <Grid size={{ xs: 12, md: categorySeries.length > 0 ? 8 : 12 }}>
            <AnalyticsWebsiteVisits
              title="Ventas por mes"
              subheader="Últimos 12 meses"
              chart={{
                categories: allMonths,
                series: [
                  { name: 'Ingresos ($)', data: allRevenue },
                  { name: 'N° ventas',    data: allCount   },
                ],
              }}
            />
          </Grid>
        )}

        {/* ── Top 10 productos más rentables ──────────────────────────────── */}
        <Grid size={{ xs: 12 }}>
          <AnalyticsConversionRates
            title="Top 10 productos más rentables"
            subheader="Por ganancia neta generada"
            chart={{
              categories: topLabels,
              series: [
                { name: 'Unidades vendidas', data: topQuantities },
                { name: 'Ganancia ($)',       data: topProfits    },
              ],
            }}
          />
        </Grid>

      </Grid>
    </DashboardContent>
  );
}
