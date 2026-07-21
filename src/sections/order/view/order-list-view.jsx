import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import { DataGrid, gridClasses } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';

import { fDateTime } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetOrders, updateOrderStatus } from 'src/actions/order';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { CustomGridActionsCellItem } from 'src/components/custom-data-grid';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

export const ORDER_STATUS = {
  pending: { label: 'Pendiente', color: 'warning' },
  confirmed: { label: 'Confirmado', color: 'info' },
  completed: { label: 'Entregado', color: 'success' },
  cancelled: { label: 'Cancelado', color: 'error' },
};

const TABS = [
  { value: '', label: 'Todos' },
  ...Object.entries(ORDER_STATUS).map(([value, { label }]) => ({ value, label })),
];

// ----------------------------------------------------------------------

function OrderDialog({ order, onClose, onSaved, canUpdate }) {
  const [status, setStatus] = useState(order.status);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOrderStatus(order.id, status);
      toast.success('Pedido actualizado');
      await onSaved();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const whatsapp = order.contact_phone?.replace(/\D/g, '');

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onClose}>
      <DialogTitle>Pedido #{order.id}</DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
        <Box>
          <Typography variant="subtitle2">{order.customer_name ?? '—'}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {order.customer_email}
          </Typography>
          {order.contact_phone && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {order.contact_phone}
            </Typography>
          )}
          {order.address && (
            <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary', whiteSpace: 'pre-line' }}>
              {order.address}
            </Typography>
          )}
          {order.notes && (
            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
              «{order.notes}»
            </Typography>
          )}
        </Box>

        <Divider sx={{ borderStyle: 'dashed' }} />

        <Stack spacing={1}>
          {order.items.map((item) => (
            <Box key={item.id} sx={{ gap: 2, display: 'flex', alignItems: 'baseline' }}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2">{item.title}</Typography>
                {item.detail && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {item.detail}
                  </Typography>
                )}
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                {item.quantity}
                {item.unit ? ` ${item.unit}` : '×'} {fCurrency(item.unit_price)}
              </Typography>
              <Typography variant="body2" sx={{ minWidth: 90, textAlign: 'right' }}>
                {fCurrency(item.subtotal)}
              </Typography>
            </Box>
          ))}
        </Stack>

        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2">Total</Typography>
          <Typography variant="subtitle1">{fCurrency(order.total)}</Typography>
        </Box>

        <Divider sx={{ borderStyle: 'dashed' }} />

        <TextField
          select
          label="Estado"
          value={status}
          disabled={!canUpdate}
          onChange={(e) => setStatus(e.target.value)}
          helperText="Confirmar un pedido no registra la venta: eso se hace en el POS como siempre."
        >
          {Object.entries(ORDER_STATUS).map(([value, { label }]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>

      <DialogActions>
        {whatsapp && (
          <Button
            color="success"
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener"
            startIcon={<Iconify icon="socials:whatsapp" width={18} />}
            sx={{ mr: 'auto' }}
          >
            WhatsApp
          </Button>
        )}
        <Button color="inherit" onClick={onClose}>
          Cerrar
        </Button>
        {canUpdate && (
          <Button variant="contained" loading={saving} disabled={status === order.status} onClick={handleSave}>
            Guardar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

export function OrderListView() {
  const { user } = useAuthContext();
  const canUpdate = !!user?.permissions?.includes('orders.update');

  const [tab, setTab] = useState('');
  const [selected, setSelected] = useState(null);

  const { orders, ordersLoading, ordersMutate } = useGetOrders({ status: tab || undefined });

  const handleSaved = useCallback(async () => {
    await ordersMutate();
  }, [ordersMutate]);

  const columns = [
    { field: 'id', headerName: 'Folio', width: 90, valueGetter: (v) => `#${v}` },
    {
      field: 'customer_name',
      headerName: 'Cliente',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" noWrap>
            {params.row.customer_name ?? '—'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
            {params.row.customer_email}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'items',
      headerName: 'Artículos',
      width: 100,
      valueGetter: (v) => v?.length ?? 0,
    },
    { field: 'total', headerName: 'Total', width: 120, valueGetter: (v) => fCurrency(v) },
    {
      field: 'status',
      headerName: 'Estado',
      width: 130,
      renderCell: (params) => {
        const state = ORDER_STATUS[params.row.status] ?? ORDER_STATUS.pending;
        return (
          <Label variant="soft" color={state.color}>
            {state.label}
          </Label>
        );
      },
    },
    { field: 'created_at', headerName: 'Recibido', width: 160, valueGetter: (v) => fDateTime(v) },
    {
      type: 'actions',
      field: 'actions',
      headerName: ' ',
      width: 60,
      align: 'right',
      headerAlign: 'right',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      getActions: (params) => [
        <CustomGridActionsCellItem
          label="Ver"
          icon={<Iconify icon="solar:eye-bold" />}
          onClick={() => setSelected(params.row)}
        />,
      ],
    },
  ];

  return (
    <>
      <DashboardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <CustomBreadcrumbs
          heading="Pedidos"
          links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Pedidos' }]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card
          sx={{
            minHeight: 480,
            flexGrow: { md: 1 },
            display: { md: 'flex' },
            height: { xs: 640, md: '1px' },
            flexDirection: { md: 'column' },
          }}
        >
          <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ px: 2.5, boxShadow: (t) => `inset 0 -2px 0 0 ${t.vars.palette.grey[500]}14` }}>
            {TABS.map((item) => (
              <Tab key={item.value} value={item.value} label={item.label} />
            ))}
          </Tabs>

          <DataGrid
            disableRowSelectionOnClick
            rows={orders}
            columns={columns}
            loading={ordersLoading}
            onRowClick={(params) => setSelected(params.row)}
            pageSizeOptions={[25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            slots={{
              noRowsOverlay: () => (
                <EmptyContent
                  title="Sin pedidos"
                  description="Aquí aparecen los pedidos que hacen los clientes desde el sitio público."
                />
              ),
              noResultsOverlay: () => <EmptyContent title="Sin resultados" />,
            }}
            sx={{
              [`& .${gridClasses.cell}`]: { display: 'flex', alignItems: 'center' },
              [`& .${gridClasses.row}`]: { cursor: 'pointer' },
            }}
          />
        </Card>
      </DashboardContent>

      {selected && (
        <OrderDialog
          order={selected}
          canUpdate={canUpdate}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
