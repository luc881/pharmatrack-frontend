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
 * Wraps a route element and blocks access if the authenticated user does not
 * have at least one of the required permissions. Shows an "access denied" page.
 *
 * Usage in routes:
 *   element: <RoleBasedGuard allowedPermissions={['users.read']}><MyPage /></RoleBasedGuard>
 *
 * Permissions come from the JWT payload (`decoded.permissions`) which the backend
 * populates from the user's role at token-creation time.
 */
export function RoleBasedGuard({ children, allowedPermissions }) {
  const { user } = useAuthContext();
  const userPermissions = user?.permissions ?? [];

  const hasAccess =
    !allowedPermissions?.length ||
    allowedPermissions.some((p) => userPermissions.includes(p));

  if (!hasAccess) {
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
