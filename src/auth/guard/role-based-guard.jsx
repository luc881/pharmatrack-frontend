import { m } from 'framer-motion';

import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { RouterLink } from 'src/routes/components';

import { ForbiddenIllustration } from 'src/assets/illustrations';

import { varBounce, MotionContainer } from 'src/components/animate';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

/**
 * Wraps a route element and blocks access if the authenticated user's role
 * is not in `allowedRoles`. Shows a localised "access denied" page.
 *
 * Usage in routes:
 *   element: <RoleBasedGuard allowedRoles={['admin']}><MyPage /></RoleBasedGuard>
 */
export function RoleBasedGuard({ children, allowedRoles }) {
  const { user } = useAuthContext();
  const userRole = user?.role ?? '';

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return (
      <Container
        component={MotionContainer}
        sx={{ textAlign: 'center', py: 10 }}
      >
        <m.div variants={varBounce('in')}>
          <Typography variant="h3" sx={{ mb: 2 }}>
            Acceso denegado
          </Typography>
        </m.div>

        <m.div variants={varBounce('in')}>
          <Typography sx={{ color: 'text.secondary', mb: 4 }}>
            No tienes permisos para acceder a esta página.
          </Typography>
        </m.div>

        <m.div variants={varBounce('in')}>
          <ForbiddenIllustration sx={{ my: { xs: 5, sm: 8 } }} />
        </m.div>

        <m.div variants={varBounce('in')}>
          <Button component={RouterLink} href="/dashboard" variant="contained" size="large">
            Volver al inicio
          </Button>
        </m.div>
      </Container>
    );
  }

  return <>{children}</>;
}
