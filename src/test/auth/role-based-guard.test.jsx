import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { RoleBasedGuard } from 'src/auth/guard/role-based-guard';

// ----------------------------------------------------------------------
// Mock de dependencias externas al guard
// ----------------------------------------------------------------------

vi.mock('framer-motion', () => ({
  m: {
    div: ({ children }) => <div>{children}</div>,
  },
}));

vi.mock('src/components/animate', () => ({
  varBounce: () => ({}),
  MotionContainer: ({ children }) => <div>{children}</div>,
}));

vi.mock('src/assets/illustrations', () => ({
  ForbiddenIllustration: () => <div data-testid="forbidden-illustration" />,
}));

vi.mock('src/routes/components', () => ({
  RouterLink: ({ children, href }) => <a href={href}>{children}</a>,
}));

// Mock del contexto de autenticación — cambiamos el rol según el test
const mockUseAuthContext = vi.fn();
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

// ----------------------------------------------------------------------

describe('RoleBasedGuard', () => {
  it('muestra el contenido si el usuario tiene el rol permitido', () => {
    mockUseAuthContext.mockReturnValue({ user: { role: 'admin' } });

    render(
      <RoleBasedGuard allowedRoles={['admin']}>
        <p>Panel de administración</p>
      </RoleBasedGuard>
    );

    expect(screen.getByText('Panel de administración')).toBeInTheDocument();
    expect(screen.queryByText('Acceso denegado')).not.toBeInTheDocument();
  });

  it('muestra "Acceso denegado" si el usuario no tiene el rol requerido', () => {
    mockUseAuthContext.mockReturnValue({ user: { role: 'empleado' } });

    render(
      <RoleBasedGuard allowedRoles={['admin']}>
        <p>Panel de administración</p>
      </RoleBasedGuard>
    );

    expect(screen.getByText('Acceso denegado')).toBeInTheDocument();
    expect(screen.queryByText('Panel de administración')).not.toBeInTheDocument();
  });

  it('muestra "Acceso denegado" si no hay usuario autenticado', () => {
    mockUseAuthContext.mockReturnValue({ user: null });

    render(
      <RoleBasedGuard allowedRoles={['admin']}>
        <p>Contenido protegido</p>
      </RoleBasedGuard>
    );

    expect(screen.getByText('Acceso denegado')).toBeInTheDocument();
  });

  it('permite acceso cuando allowedRoles incluye múltiples roles', () => {
    mockUseAuthContext.mockReturnValue({ user: { role: 'empleado' } });

    render(
      <RoleBasedGuard allowedRoles={['admin', 'empleado']}>
        <p>Ventas</p>
      </RoleBasedGuard>
    );

    expect(screen.getByText('Ventas')).toBeInTheDocument();
  });
});
