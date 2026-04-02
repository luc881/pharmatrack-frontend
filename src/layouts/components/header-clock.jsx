import { useState, useEffect } from 'react';

import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

const MX_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

// ----------------------------------------------------------------------

export function HeaderClock() {
  const [time, setTime] = useState(() => MX_FORMATTER.format(new Date()));

  useEffect(() => {
    const id = setInterval(() => setTime(MX_FORMATTER.format(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Typography
      variant="caption"
      sx={{
        fontWeight: 600,
        color: 'text.secondary',
        fontFamily: 'monospace',
        letterSpacing: 0.5,
        display: { xs: 'none', md: 'block' },
        userSelect: 'none',
      }}
    >
      {time}
    </Typography>
  );
}
