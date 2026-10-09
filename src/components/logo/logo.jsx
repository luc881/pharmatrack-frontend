import { mergeClasses } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { styled } from '@mui/material/styles';

import { RouterLink } from 'src/routes/components';

import { CONFIG } from 'src/global-config';

import { logoClasses } from './classes';

// ----------------------------------------------------------------------
// Logo de Opuntia Den. Archivos de marca en public/brand/ (ver brand/BRAND.md):
// el sello completo pide 96 px mínimo; debajo de eso va el isotipo.
// ----------------------------------------------------------------------

const SOURCES = {
  full: `${CONFIG.assetsDir}/brand/assets/logo/sello-claro.svg`, // sello circular con texto
  mark: `${CONFIG.assetsDir}/brand/assets/logo/isotipo-claro.svg`, // nopal en el anillo, sin texto
  badge: `${CONFIG.assetsDir}/brand/assets/logo/isotipo-claro.svg`,
  icon: `${CONFIG.assetsDir}/brand/assets/logo/isotipo-claro.svg`, // loaders y espacios chicos
};

export function Logo({
  sx,
  disabled,
  className,
  href = '/',
  isSingle = true,
  variant = isSingle ? 'mark' : 'full',
  ...other
}) {
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
        src={SOURCES[variant] ?? SOURCES.mark}
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
