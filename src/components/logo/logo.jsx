import { mergeClasses } from 'minimal-shared/utils';

import Link from '@mui/material/Link';
import { styled, useTheme } from '@mui/material/styles';

import { RouterLink } from 'src/routes/components';

import { logoClasses } from './classes';

// ----------------------------------------------------------------------

export function Logo({ sx, disabled, className, href = '/', isSingle = true, ...other }) {
  const theme = useTheme();

  const TEXT_PRIMARY = theme.vars.palette.text.primary;

  /*
    * OR using local (public folder)
    *
    const singleLogo = (
      <img
        alt="Single logo"
        src={`${CONFIG.assetsDir}/logo/logo-single.svg`}
        width="100%"
        height="100%"
      />
    );

    const fullLogo = (
      <img
        alt="Full logo"
        src={`${CONFIG.assetsDir}/logo/logo-full.svg`}
        width="100%"
        height="100%"
      />
    );
    *
    */

  const singleLogo = (
    <svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="18" fill="#D32F2F" />
      <rect x="42" y="15" width="16" height="70" rx="4" fill="white" />
      <rect x="15" y="42" width="70" height="16" rx="4" fill="white" />
    </svg>
  );

  const fullLogo = (
    <svg width="100%" height="100%" viewBox="0 0 200 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="2" width="36" height="36" rx="7" fill="#D32F2F" />
      <rect x="15.5" y="8" width="5" height="24" rx="2" fill="white" />
      <rect x="8" y="15.5" width="20" height="5" rx="2" fill="white" />
      <text
        x="46"
        y="27"
        fontFamily="'Public Sans', sans-serif"
        fontWeight="700"
        fontSize="18"
        fill={TEXT_PRIMARY}
      >
        FarmaciaSelene
      </text>
    </svg>
  );

  return (
    <LogoRoot
      component={RouterLink}
      href={href}
      aria-label="Logo"
      underline="none"
      className={mergeClasses([logoClasses.root, className])}
      sx={[
        {
          width: 40,
          height: 40,
          ...(!isSingle && { width: 102, height: 36 }),
          ...(disabled && { pointerEvents: 'none' }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {isSingle ? singleLogo : fullLogo}
    </LogoRoot>
  );
}

// ----------------------------------------------------------------------

const LogoRoot = styled(Link)(() => ({
  flexShrink: 0,
  color: 'transparent',
  display: 'inline-flex',
  verticalAlign: 'middle',
}));
