import { mergeClasses } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { styled } from '@mui/material/styles';

import { RouterLink } from 'src/routes/components';

import { CONFIG } from 'src/global-config';

import { logoClasses } from './classes';

// ----------------------------------------------------------------------
// Logo de Opuntia Den. El archivo es el lockup completo (escudo + nombre);
// `isSingle` recorta el escudo por CSS con background-size/position, para no
// mantener dos imágenes que se acaben desincronizando.
// ----------------------------------------------------------------------

const LOGO_SRC = `${CONFIG.assetsDir}/logo/opuntia-logo.png`;

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
        sx={{
          width: 1,
          height: 1,
          backgroundImage: `url(${LOGO_SRC})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: isSingle ? 'center 27%' : 'center',
          // isSingle amplía para que sólo se vea el escudo de arriba
          backgroundSize: isSingle ? '158%' : 'contain',
        }}
      />
    </LogoRoot>
  );
}

const LogoRoot = styled(Link)(() => ({
  flexShrink: 0,
  display: 'inline-flex',
  verticalAlign: 'middle',
}));
