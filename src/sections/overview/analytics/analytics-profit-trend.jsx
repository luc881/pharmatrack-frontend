import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import { useTheme, alpha as hexAlpha } from '@mui/material/styles';

import { fCurrency } from 'src/utils/format-number';

import { Chart, useChart } from 'src/components/chart';

// ----------------------------------------------------------------------

export function AnalyticsProfitTrend({ title, subheader, chart, sx, ...other }) {
  const theme = useTheme();

  const chartColors = chart.colors ?? [
    hexAlpha(theme.palette.primary.main, 0.8),
    hexAlpha(theme.palette.error.light, 0.8),
    hexAlpha(theme.palette.success.main, 0.8),
  ];

  const chartOptions = useChart({
    colors: chartColors,
    stroke: { width: 2, curve: 'smooth' },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
    xaxis: { categories: chart.categories },
    legend: { show: true },
    tooltip: {
      shared: true,
      intersect: false,
      y: { formatter: (value) => fCurrency(value) },
    },
    ...chart.options,
  });

  return (
    <Card sx={sx} {...other}>
      <CardHeader title={title} subheader={subheader} />
      <Chart
        type="area"
        series={chart.series}
        options={chartOptions}
        slotProps={{ loading: { p: 2.5 } }}
        sx={{ pl: 1, py: 2.5, pr: 2.5, height: 364 }}
      />
    </Card>
  );
}
