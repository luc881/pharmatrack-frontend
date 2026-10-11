import Button from '@mui/material/Button';

import { RouterLink } from 'src/routes/components';

import { Iconify } from '../iconify';
import { EmptyContent } from './empty-content';

// ----------------------------------------------------------------------

// Lista vacía que dice para qué es la página y trae el botón para crear el
// primero. Sin href/onNew (p. ej. sin permiso) queda solo la explicación.
export function EmptyList({ title, description, newLabel, href, onNew, sx }) {
  const action = (href || onNew) && (
    <Button
      variant="contained"
      startIcon={<Iconify icon="mingcute:add-line" />}
      sx={{ mt: 3 }}
      {...(href ? { component: RouterLink, href } : { onClick: onNew })}
    >
      {newLabel}
    </Button>
  );

  return (
    <EmptyContent
      title={title}
      description={description}
      action={action}
      slotProps={{ description: { sx: { color: 'text.secondary', maxWidth: 440 } } }}
      sx={sx}
    />
  );
}
