import { useState, useEffect } from 'react';
import ReactApexChart from 'react-apexcharts';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { alpha, useTheme, keyframes } from '@mui/material/styles';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fToNow } from 'src/utils/format-time';

// ----------------------------------------------------------------------

const MX_TIME = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

// FastAPI devuelve timestamps sin 'Z', por lo que new Date() los interpreta como
// hora local en lugar de UTC. Forzamos UTC añadiendo 'Z' si no tiene timezone.
const parseUTC = (ts) => new Date(/Z|[+-]\d{2}:?\d{2}$/.test(ts) ? ts : `${ts}Z`);

import { useGetSensorHistory, useGetLatestSensorReading } from 'src/actions/sensor';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

function Gauge({ value, max, unit, icon, color, label, loading }) {
  const theme = useTheme();

  const series = [loading ? 0 : Math.min(Math.round((value / max) * 100), 100)];

  const chartOptions = {
    chart: { type: 'radialBar', sparkline: { enabled: true } },
    plotOptions: {
      radialBar: {
        startAngle: -135,
        endAngle: 135,
        hollow: { size: '60%' },
        track: { background: alpha(theme.palette[color].main, 0.12) },
        dataLabels: {
          name: { show: false },
          value: {
            offsetY: 6,
            fontSize: '20px',
            fontWeight: 700,
            color: theme.palette[color].main,
            formatter: () => (loading ? '—' : `${value}${unit}`),
          },
        },
      },
    },
    fill: { colors: [theme.palette[color].main] },
    stroke: { lineCap: 'round' },
  };

  return (
    <Box sx={{ textAlign: 'center', flex: 1 }}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <ReactApexChart type="radialBar" series={series} options={chartOptions} width={160} height={160} />
        <Box
          sx={{
            top: 0, left: 0, right: 0, bottom: 28,
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Iconify icon={icon} width={20} sx={{ color: `${color}.main`, mt: 2 }} />
        </Box>
      </Box>
      <Typography variant="subtitle2" sx={{ color: 'text.secondary', mt: -1 }}>
        {label}
      </Typography>
    </Box>
  );
}

// ----------------------------------------------------------------------

function MiniChart({ data, color, field }) {
  const theme = useTheme();

  const series = [{ name: field === 'temperature' ? 'Temp.' : 'Hum.', data: [...data].reverse().map((r) => parseFloat(r[field]?.toFixed(1) ?? 0)) }];
  const categories = [...data].reverse().map((r) => {
    const d = new Date(r.recorded_at);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  const options = {
    chart: { type: 'area', toolbar: { show: false }, sparkline: { enabled: false }, zoom: { enabled: false } },
    stroke: { curve: 'smooth', width: 2 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0,
      },
    },
    colors: [theme.palette[color].main],
    xaxis: { categories, labels: { style: { fontSize: '10px' }, rotate: -45 }, tickAmount: 6 },
    yaxis: { labels: { style: { fontSize: '10px' }, formatter: (v) => v.toFixed(1) } },
    tooltip: { x: { show: true }, y: { formatter: (v) => `${v.toFixed(1)}${field === 'temperature' ? '°C' : '%'}` } },
    grid: { borderColor: theme.palette.divider, strokeDashArray: 3 },
    dataLabels: { enabled: false },
  };

  return (
    <ReactApexChart type="area" series={series} options={options} height={120} />
  );
}

// ----------------------------------------------------------------------

const pulse = keyframes`
  0%   { transform: scale(1);   opacity: 1; }
  50%  { transform: scale(1.6); opacity: 0.5; }
  100% { transform: scale(1);   opacity: 1; }
`;

const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000;

// ----------------------------------------------------------------------

export function SensorWidget() {
  const { reading, readingLoading, readingError } = useGetLatestSensorReading();
  const { history, historyLoading } = useGetSensorHistory({ pageSize: 24 });
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const noData = !readingLoading && (readingError || !reading);

  const isOnline =
    reading?.recorded_at &&
    now - parseUTC(reading.recorded_at).getTime() < OFFLINE_THRESHOLD_MS;

  const statusColor = isOnline ? 'success' : 'error';

  return (
    <Card sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Iconify icon="solar:temperature-bold-duotone" width={22} sx={{ color: 'info.main' }} />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Sensor ambiental
        </Typography>

        {/* Online/offline dot */}
        {!readingLoading && (
          <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', mr: 0.5 }}>
            {isOnline && (
              <Box
                sx={{
                  position: 'absolute',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: (theme) => alpha(theme.palette.success.main, 0.4),
                  animation: `${pulse} 2s ease-in-out infinite`,
                }}
              />
            )}
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: `${statusColor}.main`,
              }}
            />
          </Box>
        )}

        {/* Last reading time */}
        {reading?.recorded_at && (
          <Stack alignItems="flex-end" spacing={0}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, lineHeight: 1.2 }}>
              {MX_TIME.format(parseUTC(reading.recorded_at))}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', lineHeight: 1.2 }}>
              {fToNow(parseUTC(reading.recorded_at))}
            </Typography>
          </Stack>
        )}
        {readingLoading && (
          <Skeleton variant="rounded" width={70} height={32} />
        )}
      </Stack>

      {noData ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Iconify icon="solar:wifi-router-bold-duotone" width={40} sx={{ color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Sin datos del sensor
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            Verifica que el ESP32 esté conectado
          </Typography>
          <Button
            component={RouterLink}
            href={paths.dashboard.sensor}
            size="small"
            variant="outlined"
            sx={{ mt: 1.5 }}
          >
            Configurar
          </Button>
        </Box>
      ) : (
        <>
          {/* Gauges */}
          <Stack direction="row" divider={<Divider orientation="vertical" flexItem />} sx={{ mb: 2 }}>
            <Gauge
              value={reading ? parseFloat(reading.temperature?.toFixed(1)) : 0}
              max={50}
              unit="°C"
              icon="solar:temperature-bold"
              color="error"
              label="Temperatura"
              loading={readingLoading}
            />
            <Gauge
              value={reading ? parseFloat(reading.humidity?.toFixed(1)) : 0}
              max={100}
              unit="%"
              icon="solar:water-bold"
              color="info"
              label="Humedad"
              loading={readingLoading}
            />
          </Stack>

          {/* History charts */}
          {!historyLoading && history.length > 1 && (
            <Box>
              <Divider sx={{ mb: 1.5 }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', px: 0.5 }}>
                Últimas {history.length} lecturas
              </Typography>
              <MiniChart data={history} color="error" field="temperature" />
              <MiniChart data={history} color="info" field="humidity" />
            </Box>
          )}

          <Divider sx={{ mt: 2, mb: 1.5 }} />
          <Button
            component={RouterLink}
            href={paths.dashboard.sensor}
            size="small"
            variant="text"
            endIcon={<Iconify icon="eva:arrow-ios-forward-fill" width={16} />}
          >
            Configurar sensor
          </Button>
        </>
      )}
    </Card>
  );
}
