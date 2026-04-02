import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import { alpha, useTheme, keyframes } from '@mui/material/styles';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetSensorHistory, useGetLatestSensorReading } from 'src/actions/sensor';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------

const MX_TIME = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});

const parseUTC = (ts) => new Date(/Z|[+-]\d{2}:?\d{2}$/.test(ts) ? ts : `${ts}Z`);

const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000;

const pulse = keyframes`
  0%   { transform: scale(1);   opacity: 1; }
  50%  { transform: scale(1.6); opacity: 0.5; }
  100% { transform: scale(1);   opacity: 1; }
`;

// ----------------------------------------------------------------------

const WIFI_STEPS = [
  {
    number: 1,
    icon: 'solar:restart-bold-duotone',
    color: 'warning',
    title: 'Mantén presionado el botón BOOT',
    description:
      'Mientras el sensor esté encendido, presiona y mantén apretado el botón pequeño marcado como "BOOT" en el dispositivo por 3 segundos. El sensor se reiniciará automáticamente.',
  },
  {
    number: 2,
    icon: 'solar:wifi-router-bold-duotone',
    color: 'info',
    title: 'Conéctate a la red del sensor',
    description:
      'Desde tu celular o computadora, abre la lista de redes WiFi disponibles. Aparecerá una red llamada "PharmaTrack-Sensor". Conéctate a ella (no tiene contraseña).',
  },
  {
    number: 3,
    icon: 'solar:smartphone-bold-duotone',
    color: 'primary',
    title: 'Abre el portal de configuración',
    description:
      'Al conectarte, se abrirá una página automáticamente en tu celular. Si no se abre sola, escribe 192.168.4.1 en el navegador. Toca "Configure WiFi", selecciona tu red, escribe la contraseña y guarda.',
  },
  {
    number: 4,
    icon: 'solar:check-circle-bold-duotone',
    color: 'success',
    title: 'El sensor se reconecta solo',
    description:
      'El sensor guardará la nueva red y se conectará automáticamente. En menos de un minuto debería aparecer "En línea" en el indicador de estado de esta página.',
  },
];

const TROUBLESHOOT_ITEMS = [
  {
    icon: 'solar:wifi-bold-duotone',
    color: 'warning',
    problem: 'El sensor dice "Sin señal"',
    solution:
      'Verifica que el sensor esté encendido y que haya luz en el dispositivo. Si el WiFi de la farmacia cambió de nombre o contraseña, sigue los pasos para cambiar la red.',
  },
  {
    icon: 'solar:plug-circle-bold-duotone',
    color: 'error',
    problem: 'No aparece la red "PharmaTrack-Sensor"',
    solution:
      'Asegúrate de que el sensor esté encendido. Espera 30 segundos después de encenderlo. Si aún no aparece, desconecta y vuelve a conectar la alimentación del sensor.',
  },
  {
    icon: 'solar:lock-password-bold-duotone',
    color: 'info',
    problem: 'El portal se abre pero no guarda la contraseña',
    solution:
      'Verifica que estás escribiendo correctamente la contraseña del WiFi. Las contraseñas distinguen mayúsculas y minúsculas. Intenta acercar el sensor al router durante la configuración.',
  },
  {
    icon: 'solar:danger-triangle-bold-duotone',
    color: 'error',
    problem: 'La temperatura o humedad se ven en rojo',
    solution:
      'Las condiciones están fuera del rango ideal para conservar medicamentos. Revisa la ventilación, el aire acondicionado o la ubicación del sensor. Temperatura ideal: 15–25°C. Humedad ideal: 30–60%.',
  },
];

// ----------------------------------------------------------------------

function StatusCard() {
  const theme = useTheme();
  const { reading, readingLoading } = useGetLatestSensorReading();
  const { history } = useGetSensorHistory({ pageSize: 5 });
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const isOnline =
    reading?.recorded_at &&
    now - parseUTC(reading.recorded_at).getTime() < OFFLINE_THRESHOLD_MS;

  const statusColor = isOnline ? 'success' : 'error';
  const statusLabel = isOnline ? 'En línea' : 'Sin señal';

  return (
    <Card>
      <CardHeader
        title="Estado del sensor"
        subheader="Se actualiza automáticamente cada 30 segundos"
        avatar={
          <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            {isOnline && (
              <Box
                sx={{
                  position: 'absolute', width: 14, height: 14, borderRadius: '50%',
                  bgcolor: alpha(theme.palette.success.main, 0.4),
                  animation: `${pulse} 2s ease-in-out infinite`,
                }}
              />
            )}
            <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: `${statusColor}.main` }} />
          </Box>
        }
        action={
          readingLoading ? (
            <Skeleton variant="rounded" width={80} height={28} sx={{ borderRadius: 10, mt: 1 }} />
          ) : (
            <Chip label={statusLabel} color={statusColor} size="small" variant="soft" sx={{ mt: 1 }} />
          )
        }
      />
      <Divider />
      <CardContent>
        {readingLoading ? (
          <Stack direction="row" spacing={3}>
            <Skeleton variant="rounded" width={120} height={60} />
            <Skeleton variant="rounded" width={120} height={60} />
          </Stack>
        ) : reading ? (
          <Stack direction="row" spacing={4} flexWrap="wrap">
            <Stack spacing={0.25}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Iconify icon="solar:temperature-bold-duotone" width={20} sx={{ color: 'error.main' }} />
                <Typography variant="h4" sx={{ color: 'error.main' }}>
                  {reading.temperature?.toFixed(1)}°C
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Temperatura</Typography>
            </Stack>

            <Stack spacing={0.25}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Iconify icon="solar:drop-bold-duotone" width={20} sx={{ color: 'info.main' }} />
                <Typography variant="h4" sx={{ color: 'info.main' }}>
                  {reading.humidity?.toFixed(0)}%
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Humedad relativa</Typography>
            </Stack>

            <Stack spacing={0.25} sx={{ ml: 'auto' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Última lectura</Typography>
              <Typography variant="subtitle2">{MX_TIME.format(parseUTC(reading.recorded_at))}</Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                {history.length > 0 ? `${history.length} registros recientes` : ''}
              </Typography>
            </Stack>
          </Stack>
        ) : (
          <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 1 }}>
            <Iconify icon="solar:wifi-router-bold-duotone" width={36} sx={{ color: 'text.disabled' }} />
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                El sensor no está enviando datos
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                Verifica que el dispositivo esté encendido y conectado al WiFi
              </Typography>
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------

function RangesCard() {
  const theme = useTheme();

  const ranges = [
    {
      icon: 'solar:temperature-bold-duotone',
      color: 'success',
      label: 'Temperatura ideal',
      value: '15 – 25 °C',
      warning: 'Alerta si supera 25°C',
      critical: 'Crítico si supera 30°C',
    },
    {
      icon: 'solar:drop-bold-duotone',
      color: 'info',
      label: 'Humedad ideal',
      value: '30 – 60 %',
      warning: 'Alerta si supera 60%',
      critical: 'Crítico si supera 70%',
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Condiciones ideales de almacenamiento"
        subheader="Rangos recomendados para conservar medicamentos correctamente"
        avatar={
          <Box sx={{ p: 1, borderRadius: 1.5, display: 'flex', bgcolor: alpha(theme.palette.success.main, 0.12) }}>
            <Iconify icon="solar:shield-check-bold-duotone" width={24} sx={{ color: 'success.main' }} />
          </Box>
        }
      />
      <Divider />
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          {ranges.map((r) => (
            <Box
              key={r.label}
              sx={{
                flex: 1, p: 2, borderRadius: 1.5,
                border: '1px solid',
                borderColor: alpha(theme.palette[r.color].main, 0.2),
                bgcolor: alpha(theme.palette[r.color].main, 0.04),
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                <Iconify icon={r.icon} width={28} sx={{ color: `${r.color}.main` }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{r.label}</Typography>
                  <Typography variant="h5" sx={{ color: `${r.color}.main`, lineHeight: 1.2 }}>
                    {r.value}
                  </Typography>
                </Box>
              </Stack>
              <Stack spacing={0.5}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main', flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{r.warning}</Typography>
                </Stack>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main', flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{r.critical}</Typography>
                </Stack>
              </Stack>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------

function WifiStepsCard() {
  const theme = useTheme();

  return (
    <Card>
      <CardHeader
        title="¿Cómo cambiar la red WiFi del sensor?"
        subheader="Sigue estos pasos si el WiFi de la farmacia cambió o el sensor no se conecta"
        avatar={
          <Box sx={{ p: 1, borderRadius: 1.5, display: 'flex', bgcolor: alpha(theme.palette.primary.main, 0.12) }}>
            <Iconify icon="solar:settings-bold-duotone" width={24} sx={{ color: 'primary.main' }} />
          </Box>
        }
      />
      <Divider />
      <CardContent>
        <Stack spacing={2}>
          {WIFI_STEPS.map((step, index) => (
            <Box key={step.number}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                {/* Number */}
                <Box
                  sx={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: alpha(theme.palette[step.color].main, 0.12),
                  }}
                >
                  <Typography variant="subtitle2" sx={{ color: `${step.color}.main`, fontWeight: 700 }}>
                    {step.number}
                  </Typography>
                </Box>

                <Box sx={{ flex: 1, pt: 0.25 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                    <Iconify icon={step.icon} width={18} sx={{ color: `${step.color}.main` }} />
                    <Typography variant="subtitle2">{step.title}</Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {step.description}
                  </Typography>
                </Box>
              </Stack>

              {index < WIFI_STEPS.length - 1 && (
                <Box sx={{ ml: '17px', mt: 1, mb: 0, borderLeft: '2px dashed', borderColor: 'divider', height: 16 }} />
              )}
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------

function TroubleshootCard() {
  const theme = useTheme();

  return (
    <Card>
      <CardHeader
        title="Solución de problemas frecuentes"
        subheader="Qué hacer si algo no funciona como se espera"
        avatar={
          <Box sx={{ p: 1, borderRadius: 1.5, display: 'flex', bgcolor: alpha(theme.palette.warning.main, 0.12) }}>
            <Iconify icon="solar:question-circle-bold-duotone" width={24} sx={{ color: 'warning.main' }} />
          </Box>
        }
      />
      <Divider />
      <CardContent>
        <Stack spacing={2}>
          {TROUBLESHOOT_ITEMS.map((item) => (
            <Stack
              key={item.problem}
              direction="row"
              spacing={2}
              alignItems="flex-start"
              sx={{
                p: 2, borderRadius: 1.5,
                bgcolor: alpha(theme.palette[item.color].main, 0.04),
                border: '1px solid',
                borderColor: alpha(theme.palette[item.color].main, 0.15),
              }}
            >
              <Iconify icon={item.icon} width={24} sx={{ color: `${item.color}.main`, flexShrink: 0, mt: 0.25 }} />
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{item.problem}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>{item.solution}</Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------

export function SensorConfigView() {
  return (
    <DashboardContent maxWidth="lg">
      <CustomBreadcrumbs
        heading="Sensor ambiental"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Sensor ambiental' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <StatusCard />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <RangesCard />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Alert severity="info" icon={<Iconify icon="solar:info-circle-bold-duotone" width={22} />}>
            <Typography variant="body2">
              El sensor registra la temperatura y humedad de la farmacia cada 30 segundos y envía
              una notificación automática si las condiciones salen del rango ideal.
              Si el sensor lleva más de 2 minutos sin enviar datos, aparecerá como <strong>&quot;Sin señal&quot;</strong>.
            </Typography>
          </Alert>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <WifiStepsCard />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <TroubleshootCard />
        </Grid>
      </Grid>
    </DashboardContent>
  );
}
