import { m } from 'framer-motion';
import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { varTap, varHover, transitionTap } from 'src/components/animate';

import { useNotifications } from './use-notifications';
import { NotificationItem } from './notification-item';

// ----------------------------------------------------------------------

export function NotificationsDrawer({ sx, ...other }) {
  const { value: open, onFalse: onClose, onTrue: onOpen } = useBoolean();

  const { notifications, notificationsLoading, totalUnread } = useNotifications();

  const renderHead = () => (
    <Box sx={{ py: 2, pr: 1, pl: 2.5, minHeight: 68, display: 'flex', alignItems: 'center' }}>
      <Typography variant="h6" sx={{ flexGrow: 1 }}>
        Notificaciones
      </Typography>

      <IconButton onClick={onClose}>
        <Iconify icon="mingcute:close-line" />
      </IconButton>
    </Box>
  );

  const renderEmpty = () => (
    <Box sx={{ py: 10, textAlign: 'center' }}>
      <Iconify icon="solar:bell-off-bold-duotone" width={48} sx={{ color: 'text.disabled', mb: 2 }} />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Sin notificaciones pendientes
      </Typography>
    </Box>
  );

  const renderList = () => {
    if (notificationsLoading) {
      return (
        <Box sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={32} />
        </Box>
      );
    }

    if (!notifications.length) return renderEmpty();

    return (
      <Scrollbar>
        <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
          {notifications.map((notification) => (
            <Box component="li" key={notification.id} sx={{ display: 'flex' }}>
              <NotificationItem notification={notification} onClose={onClose} />
            </Box>
          ))}
        </Box>
      </Scrollbar>
    );
  };

  return (
    <>
      <Tooltip title="Notificaciones">
        <IconButton
          component={m.button}
          whileTap={varTap(0.96)}
          whileHover={varHover(1.04)}
          transition={transitionTap()}
          aria-label="Notificaciones"
          onClick={onOpen}
          sx={sx}
          {...other}
        >
          <Badge badgeContent={totalUnread} color="error">
            <Iconify width={24} icon="solar:bell-bing-bold-duotone" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Drawer
        open={open}
        onClose={onClose}
        anchor="right"
        slotProps={{
          backdrop: { invisible: true },
          paper: { sx: { width: 1, maxWidth: 400 } },
        }}
      >
        {renderHead()}
        <Divider />
        {renderList()}

        {!!notifications.length && (
          <Box sx={{ p: 1.5 }}>
            <Box
              component={RouterLink}
              href={paths.dashboard.productBatch.root}
              onClick={onClose}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
                py: 1,
                borderRadius: 1,
                typography: 'body2',
                color: 'text.secondary',
                '&:hover': { color: 'text.primary' },
              }}
            >
              Ver todos los lotes
              <Iconify icon="eva:arrow-ios-forward-fill" width={16} />
            </Box>
          </Box>
        )}
      </Drawer>
    </>
  );
}
