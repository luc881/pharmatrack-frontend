import { useFormContext } from 'react-hook-form';
import { useRef, useEffect, useContext } from 'react';
import { useBlocker, UNSAFE_DataRouterContext } from 'react-router';

import Button from '@mui/material/Button';

import { ConfirmDialog } from 'src/components/custom-dialog';

// ----------------------------------------------------------------------

// Dentro de un formulario de página: si ya se llenó algo y no se ha guardado,
// pregunta antes de salir (link, «Cancelar», atrás) y el navegador avisa al
// cerrar o recargar. Al guardar no pregunta: el navigate() del submit ocurre
// con isSubmitting=true.
export function FormLeaveGuard() {
  // useBlocker solo existe con el router de datos (en tests con MemoryRouter no)
  return useContext(UNSAFE_DataRouterContext) ? <Guard /> : null;
}

function Guard() {
  const { formState } = useFormContext();
  const dirty = formState.isDirty && !formState.isSubmitting;

  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
      title="¿Salir sin guardar?"
      content="Lo que llenaste en este formulario se pierde. «Cancelar» te deja seguir editando."
      action={
        <Button variant="contained" color="error" onClick={() => blocker.proceed?.()}>
          Salir sin guardar
        </Button>
      }
    />
  );
}
