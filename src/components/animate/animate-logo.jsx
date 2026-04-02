import { m } from 'framer-motion';
import { varAlpha } from 'minimal-shared/utils';

import { styled } from '@mui/material/styles';

// ----------------------------------------------------------------------

export function AnimateLogoZoom({ logo, slotProps, sx, ...other }) {
  return (
    <LogoZoomRoot sx={sx} {...other}>
      <m.span
        animate={{ scale: [1, 0.9, 0.9, 1, 1], opacity: [1, 0.48, 0.48, 1, 1] }}
        transition={{
          duration: 2,
          repeatDelay: 1,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {logo ?? (
          <MedicalCross style={{ width: 64, height: 64, ...slotProps?.logo?.sx }} />
        )}
      </m.span>

      <LogoZoomPrimaryOutline
        animate={{
          scale: [1.6, 1, 1, 1.6, 1.6],
          rotate: [270, 0, 0, 270, 270],
          opacity: [0.25, 1, 1, 1, 0.25],
          borderRadius: ['25%', '25%', '50%', '50%', '25%'],
        }}
        transition={{ ease: 'linear', duration: 3.2, repeat: Infinity }}
      />

      <LogoZoomSecondaryOutline
        animate={{
          scale: [1, 1.2, 1.2, 1, 1],
          rotate: [0, 270, 270, 0, 0],
          opacity: [1, 0.25, 0.25, 0.25, 1],
          borderRadius: ['25%', '25%', '50%', '50%', '25%'],
        }}
        transition={{ ease: 'linear', duration: 3.2, repeat: Infinity }}
      />
    </LogoZoomRoot>
  );
}

// Cruz médica SVG inline
function MedicalCross({ style }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" style={style}>
      <rect width="100" height="100" rx="18" fill="#D32F2F" />
      <rect x="42" y="15" width="16" height="70" rx="4" fill="white" />
      <rect x="15" y="42" width="70" height="16" rx="4" fill="white" />
    </svg>
  );
}

// ----------------------------------------------------------------------

const LogoZoomRoot = styled('div')(() => ({
  width: 120,
  height: 120,
  alignItems: 'center',
  position: 'relative',
  display: 'inline-flex',
  justifyContent: 'center',
}));

const LogoZoomPrimaryOutline = styled(m.span)(({ theme }) => ({
  position: 'absolute',
  width: 'calc(100% - 20px)',
  height: 'calc(100% - 20px)',
  border: `solid 3px ${varAlpha(theme.vars.palette.primary.darkChannel, 0.24)}`,
}));

const LogoZoomSecondaryOutline = styled(m.span)(({ theme }) => ({
  width: '100%',
  height: '100%',
  position: 'absolute',
  border: `solid 8px ${varAlpha(theme.vars.palette.primary.darkChannel, 0.24)}`,
}));

// ----------------------------------------------------------------------

export function AnimateLogoRotate({ logo, sx, slotProps, ...other }) {
  return (
    <LogoRotateRoot sx={sx} {...other}>
      {logo ?? (
        <MedicalCross style={{ zIndex: 9, width: 40, height: 40, ...slotProps?.logo?.sx }} />
      )}

      <LogoRotateBackground
        animate={{ rotate: 360 }}
        transition={{ duration: 10, ease: 'linear', repeat: Infinity }}
      />
    </LogoRotateRoot>
  );
}

const LogoRotateRoot = styled('div')(() => ({
  width: 96,
  height: 96,
  alignItems: 'center',
  position: 'relative',
  display: 'inline-flex',
  justifyContent: 'center',
}));

const LogoRotateBackground = styled(m.span)(({ theme }) => ({
  width: '100%',
  height: '100%',
  opacity: 0.16,
  borderRadius: '50%',
  position: 'absolute',
  backgroundImage: `linear-gradient(135deg, transparent 50%, ${theme.vars.palette.primary.main} 100%)`,
  transition: theme.transitions.create(['opacity'], {
    easing: theme.transitions.easing.easeInOut,
    duration: theme.transitions.duration.shorter,
  }),
}));
