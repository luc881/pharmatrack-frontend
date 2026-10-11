import { useState, useCallback } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

// ----------------------------------------------------------------------

// Pregunta en el diálogo del dashboard en vez de window.confirm, con botones
// que dicen qué hacen. `await ask({ title, content, options })` devuelve el
// `value` del botón elegido, o null si se cierra o se toca «Cancelar».
//   const [ask, askDialog] = useAsk();  …  return <>{…}{askDialog}</>;
export function useAsk() {
  const [req, setReq] = useState(null);
  // lo último preguntado, para que el texto no se borre durante la animación de cierre
  const [last, setLast] = useState(null);

  const ask = useCallback(
    (opts) =>
      new Promise((resolve) => {
        const r = { ...opts, resolve };
        setReq(r);
        setLast(r);
      }),
    []
  );

  const answer = (value) => {
    req?.resolve(value);
    setReq(null);
  };

  const shown = req ?? last;

  const dialog = (
    <Dialog fullWidth maxWidth="xs" open={!!req} onClose={() => answer(null)}>
      <DialogTitle sx={{ pb: 2 }}>{shown?.title}</DialogTitle>
      {shown?.content && (
        <DialogContent sx={{ typography: 'body2' }}>{shown.content}</DialogContent>
      )}
      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={() => answer(null)}>
          Cancelar
        </Button>
        {shown?.options.map((o) => (
          <Button
            key={o.label}
            variant={o.variant ?? 'contained'}
            color={o.color ?? 'primary'}
            onClick={() => answer(o.value)}
          >
            {o.label}
          </Button>
        ))}
      </DialogActions>
    </Dialog>
  );

  return [ask, dialog];
}
