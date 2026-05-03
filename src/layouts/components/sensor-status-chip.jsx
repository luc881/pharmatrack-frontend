import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { alpha, keyframes } from '@mui/material/styles';

import { useGetLatestSensorReading } from 'src/actions/sensor';

// ----------------------------------------------------------------------

const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutos

const MX_TIME = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const parseUTC = (ts) => new Date(/Z|[+-]\d{2}:?\d{2}$/.test(ts) ? ts : `${ts}Z`);

const pulse = keyframes`
  0%   { transform: scale(1);   opacity: 1; }
  50%  { transform: scale(1.5); opacity: 0.6; }
  100% { transform: scale(1);   opacity: 1; }
`;

// ----------------------------------------------------------------------

export function SensorStatusChip() {
  const { reading, readingLoading } = useGetLatestSensorReading();
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (readingLoading) {
    return <Skeleton variant="rounded" width={90} height={28} sx={{ borderRadius: 10 }} />;
  }

  const isOnline =
    reading?.recorded_at &&
    now - parseUTC(reading.recorded_at).getTime() < OFFLINE_THRESHOLD_MS;

  const statusColor = isOnline ? 'success' : 'error';

  const lastTime = reading?.recorded_at ? MX_TIME.format(parseUTC(reading.recorded_at)) : null;

  const tooltipTitle = isOnline
    ? `Sensor activo · última lectura: ${lastTime}`
    : reading
    ? `Sensor sin respuesta · última lectura: ${lastTime}`
    : 'Sin datos del sensor · verifica conexión del ESP32';

  return (
    <Tooltip title={tooltipTitle} arrow>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.25,
          py: 0.5,
          borderRadius: 10,
          border: '1px solid',
          borderColor: (theme) => alpha(theme.palette[statusColor].main, 0.24),
          bgcolor: (theme) => alpha(theme.palette[statusColor].main, 0.08),
          cursor: 'default',
          userSelect: 'none',
        }}
      >
        {/* Status dot */}
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {isOnline && (
            <Box
              sx={{
                position: 'absolute',
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: (theme) => alpha(theme.palette.success.main, 0.4),
                animation: `${pulse} 2s ease-in-out infinite`,
              }}
            />
          )}
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: `${statusColor}.main`,
              flexShrink: 0,
            }}
          />
        </Box>

        {/* Values — hidden on xs */}
        {isOnline && reading ? (
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              display: { xs: 'none', sm: 'block' },
              lineHeight: 1,
              letterSpacing: 0,
            }}
          >
            {parseFloat(reading.temperature?.toFixed(1))}°C&nbsp;&nbsp;
            {parseFloat(reading.humidity?.toFixed(0))}%
          </Typography>
        ) : (
          <Typography
            variant="caption"
            sx={{
              fontWeight: 500,
              color: 'text.disabled',
              display: { xs: 'none', sm: 'block' },
              lineHeight: 1,
            }}
          >
            Sin señal
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}
