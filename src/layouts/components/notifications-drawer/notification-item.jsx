import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ListItemButton from '@mui/material/ListItemButton';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const SEVERITY_CONFIG = {
  error:   { icon: 'solar:danger-bold-duotone',   color: 'error.main' },
  warning: { icon: 'solar:clock-circle-bold-duotone', color: 'warning.main' },
  info:    { icon: 'solar:box-bold-duotone',       color: 'info.main' },
};

// ----------------------------------------------------------------------

export function NotificationItem({ notification, onClose }) {
  const { icon, color } = SEVERITY_CONFIG[notification.severity] ?? SEVERITY_CONFIG.info;

  return (
    <ListItemButton
      component={RouterLink}
      href={paths.dashboard.productBatch.root}
      onClick={onClose}
      disableRipple
      sx={[
        (theme) => ({
          px: 2.5,
          py: 1.5,
          gap: 2,
          alignItems: 'flex-start',
          borderBottom: `dashed 1px ${theme.vars.palette.divider}`,
          bgcolor: notification.isUnRead ? 'action.selected' : 'transparent',
          '&:hover': { bgcolor: 'action.hover' },
        }),
      ]}
    >
      {/* Unread dot */}
      {notification.isUnRead && (
        <Box
          sx={{
            top: 18,
            right: 12,
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: 'error.main',
            position: 'absolute',
          }}
        />
      )}

      {/* Icon */}
      <Box
        sx={{
          width: 40,
          height: 40,
          flexShrink: 0,
          display: 'flex',
          borderRadius: '50%',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.neutral',
        }}
      >
        <Iconify icon={icon} width={22} sx={{ color }} />
      </Box>

      {/* Text */}
      <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
        <Typography variant="subtitle2" noWrap>
          {notification.title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
          {notification.message}
        </Typography>
      </Box>
    </ListItemButton>
  );
}
