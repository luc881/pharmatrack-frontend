import { memo, useId } from 'react';
import { Icon } from '@iconify/react';
import { mergeClasses } from 'minimal-shared/utils';

import { styled } from '@mui/material/styles';

import { iconifyClasses } from './classes';
import { allIconNames, registerIcons } from './register-icons';

// ----------------------------------------------------------------------

// Memoizado a propósito, no por rendimiento. Iconify vuelve a escribir el
// contenido del <svg> en cada render, o sea que reemplaza el nodo <path>. Si
// eso pasa entre el mousedown y el mouseup de un clic (por ejemplo cuando el
// DataGrid enfoca la celda), Chrome ya no dispara el evento click y el botón
// parece necesitar dos clics. Con memo, un icono de props estables no se
// vuelve a renderizar y su DOM se queda quieto.
export const Iconify = memo(function Iconify({ className, icon, width = 20, height, sx, ...other }) {
  const uniqueId = useId();

  if (!allIconNames.includes(icon)) {
    console.warn(
      [
        `Icon "${icon}" is currently loaded online, which may cause flickering effects.`,
        `To ensure a smoother experience, please register your icon collection for offline use.`,
        `More information is available at: https://docs.minimals.cc/icons/`,
      ].join('\n')
    );
  }

  registerIcons();

  return (
    <IconRoot
      ssr
      id={uniqueId}
      icon={icon}
      className={mergeClasses([iconifyClasses.root, className])}
      sx={[
        {
          width,
          flexShrink: 0,
          height: height ?? width,
          display: 'inline-flex',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    />
  );
});

// ----------------------------------------------------------------------

const IconRoot = styled(Icon)``;
