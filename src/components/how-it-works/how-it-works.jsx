import { useState } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { Iconify } from '../iconify';

// ----------------------------------------------------------------------

// Explicación corta arriba de una página: se cierra con la X y vuelve con el
// botón «{question}». Que esté cerrada se recuerda por navegador (storageKey).
export function HowItWorks({ storageKey, question, summary, steps }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });
  const toggle = (v) => {
    setHidden(v);
    try {
      localStorage.setItem(storageKey, v ? '1' : '0');
    } catch {
      // sin almacenamiento: solo dura esta visita
    }
  };

  if (hidden) {
    return (
      <Button
        size="small"
        color="inherit"
        startIcon={<Iconify icon="solar:question-circle-bold" />}
        onClick={() => toggle(false)}
        sx={{ mb: 2 }}
      >
        {question}
      </Button>
    );
  }

  return (
    <Alert severity="info" onClose={() => toggle(true)} sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {summary}
      </Typography>
      <Box component="ol" sx={{ m: 0, pl: 2.5, typography: 'body2' }}>
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </Box>
    </Alert>
  );
}
