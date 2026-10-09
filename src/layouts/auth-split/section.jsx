import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { RouterLink } from 'src/routes/components';

// ----------------------------------------------------------------------

export function AuthSplitSection({
  sx,
  method,
  methods,
  layoutQuery = 'md',
  title = 'Bienvenido',
  subtitle = 'Sistema de gestión para Opuntia Den.',
  ...other
}) {
  return (
    <Box
      sx={[
        (theme) => ({
          // Noche de la marca (BRAND.md: fondos oscuros, sin degradados)
          background: '#2E2924',
          px: 3,
          pb: 3,
          width: 1,
          maxWidth: 480,
          display: 'none',
          position: 'relative',
          pt: 'var(--layout-header-desktop-height)',
          [theme.breakpoints.up(layoutQuery)]: {
            gap: 4,
            display: 'flex',
            alignItems: 'center',
            flexDirection: 'column',
            justifyContent: 'center',
          },
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <div>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Box
            component="img"
            src="/brand/assets/logo/sello-oscuro.svg"
            alt="Opuntia Den"
            sx={{ width: 140, height: 140 }}
          />
        </Box>

        <Typography variant="h3" sx={{ textAlign: 'center', color: '#F4F0E9', fontWeight: 500 }}>
          {title}
        </Typography>

        {subtitle && (
          <Typography sx={{ color: '#C9C0B2', textAlign: 'center', mt: 2 }}>
            {subtitle}
          </Typography>
        )}
      </div>

      {!!methods?.length && method && (
        <Box component="ul" sx={{ gap: 2, display: 'flex' }}>
          {methods.map((option) => {
            const selected = method === option.label.toLowerCase();

            return (
              <Box
                key={option.label}
                component="li"
                sx={{
                  ...(!selected && {
                    cursor: 'not-allowed',
                    filter: 'grayscale(1)',
                  }),
                }}
              >
                <Tooltip title={option.label} placement="top">
                  <Link
                    component={RouterLink}
                    href={option.path}
                    sx={{ ...(!selected && { pointerEvents: 'none' }) }}
                  >
                    <Box
                      component="img"
                      alt={option.label}
                      src={option.icon}
                      sx={{ width: 32, height: 32 }}
                    />
                  </Link>
                </Tooltip>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
