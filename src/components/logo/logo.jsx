import { mergeClasses } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { styled } from '@mui/material/styles';

import { RouterLink } from 'src/routes/components';

import { CONFIG } from 'src/global-config';

import { logoClasses } from './classes';

// ----------------------------------------------------------------------
// Logo de Opuntia Den. Dos recortes del mismo original, generados con sharp
// desde el archivo de marca: el lockup completo y sólo el escudo.
// ----------------------------------------------------------------------

const FULL_SRC = `${CONFIG.assetsDir}/logo/opuntia-logo.png`;
const MARK_SRC = `${CONFIG.assetsDir}/logo/opuntia-mark.png`;

export function Logo({ sx, disabled, className, href = '/', isSingle = true, ...other }) {
  return (
    <LogoRoot
      component={RouterLink}
      href={href}
      aria-label={CONFIG.appName}
      underline="none"
      className={mergeClasses([logoClasses.root, className])}
      sx={[
        {
          width: isSingle ? 40 : 140,
          height: 40,
          ...(disabled && { pointerEvents: 'none' }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <Box
        component="img"
        alt=""
        src={isSingle ? MARK_SRC : FULL_SRC}
        sx={{ width: 1, height: 1, objectFit: 'contain' }}
      />
    </LogoRoot>
  );
}

const LogoRoot = styled(Link)(() => ({
  flexShrink: 0,
  display: 'inline-flex',
  verticalAlign: 'middle',
}));
