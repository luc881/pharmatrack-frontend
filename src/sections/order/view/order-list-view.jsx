import useSWR from 'swr';
import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import { DataGrid, gridClasses } from '@mui/x-data-grid';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';

import { fDateTime } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

import axiosInstance, { fetcher } from 'src/lib/axios';
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
  paid: { label: 'Pagado', color: 'success' },
  confirmed: { label: 'Confirmado', color: 'info' },
  completed: { label: 'Entregado', color: 'success' },
  cancelled: { label: 'Cancelado', color: 'error' },
};

const TABS = [
  { value: '', label: 'Todos' },
  ...Object.entries(ORDER_STATUS).map(([value, { label }]) => ({ value, label })),
];

// ----------------------------------------------------------------------

// Apagado: el sitio público solo ofrece entrega en CDMX y la API rechaza
// pedidos con envío. Los pedidos con envío que ya existan no se tocan.
function ShippingToggle() {
  const { data, mutate } = useSWR('/api/v1/settings/site', fetcher, {
    revalidateOnFocus: false,
  });
  const [saving, setSaving] = useState(false);

  const onToggle = async (e) => {
    const shipping_enabled = e.target.checked;
    setSaving(true);
    try {
      // el PUT reemplaza el objeto completo: hay que mandar lo demás tal cual
      const res = await axiosInstance.put('/api/v1/settings/site', {
        ...data,
        shipping_enabled,
      });
      await mutate(res.data, { revalidate: false });
      toast.success(shipping_enabled ? 'Envíos activados' : 'Solo entrega en CDMX');
    } catch (error) {
      toast.error(error?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormControlLabel
      sx={{ mr: 0 }}
      disabled={!data || saving}
      control={<Switch checked={data?.shipping_enabled ?? true} onChange={onToggle} />}
      label={<Typography variant="body2">Aceptar envíos</Typography>}
    />
  );
}

// ----------------------------------------------------------------------

function OrderDialog({ order, onClose, onSaved, canUpdate }) {
  const [status, setStatus] = useState(order.status);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

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
  const isPickup = order.delivery_method === 'pickup';
  // Lo que se pega en la guía de la paquetería: destinatario, teléfono y domicilio
  const shippingLabel = [order.contact_name ?? order.customer_name, order.contact_phone, order.address]
    .filter(Boolean)
    .join('\n');

  const handleCopyAddress = async () => {
    await navigator.clipboard.writeText(shippingLabel);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onClose}>
      <DialogTitle>Pedido {order.code ?? `#${order.id}`}</DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
        <Box>
          <Box sx={{ gap: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="subtitle2">{order.customer_name ?? '—'}</Typography>
            <Label variant="soft" color={isPickup ? 'info' : 'default'}>
              {isPickup ? 'Entrega en CDMX' : 'Envío a domicilio'}
            </Label>
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {order.customer_email}
          </Typography>
          {order.contact_phone && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {order.contact_phone}
            </Typography>
          )}
          {order.notes && (
            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
              «{order.notes}»
            </Typography>
          )}
        </Box>

        {/* La dirección sólo estorba en entregas en persona */}
        {!isPickup &&
          (order.address ? (
            <Box
              sx={{
                p: 2,
                borderRadius: 1,
                bgcolor: 'background.neutral',
                border: (theme) => `dashed 1px ${theme.vars.palette.divider}`,
              }}
            >
              <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                <Typography variant="overline" sx={{ flexGrow: 1, color: 'text.secondary' }}>
                  Enviar a
                </Typography>
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<Iconify icon="solar:copy-bold" width={16} />}
                  onClick={handleCopyAddress}
                >
                  {copied ? '¡Copiado!' : 'Copiar para la guía'}
                </Button>
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                {order.address}
              </Typography>
            </Box>
          ) : (
            <Alert severity="warning" sx={{ typography: 'caption' }}>
              Este pedido es con envío pero el cliente no ha capturado su dirección.
              Pídesela por WhatsApp antes de cotizar.
            </Alert>
          ))}

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

        {order.payment_id && (
          <Typography variant="caption" sx={{ color: 'success.main' }}>
            Pagado en línea · referencia {order.payment_id}
          </Typography>
        )}

        <Divider sx={{ borderStyle: 'dashed' }} />

        <TextField
          select
          label="Estado"
          value={status}
          disabled={!canUpdate}
          onChange={(e) => setStatus(e.target.value)}
          helperText="Confirmar un pedido no registra la venta: eso se hace en el POS como siempre."
        >
          {Object.entries(ORDER_STATUS)
            // "Pagado" lo pone el pago en línea; a mano no (la API igual lo rechaza)
            .filter(([value]) => value !== 'paid' || order.payment_id || order.status === 'paid')
            .map(([value, { label }]) => (
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
    {
      field: 'code',
      headerName: 'Folio',
      width: 130,
      valueGetter: (v, row) => v ?? `#${row.id}`,
    },
    {
      field: 'customer_name',
      headerName: 'Cliente',
      flex: 1,
      minWidth: 220,
      // valueGetter combinado: la búsqueda y el filtro de la tabla
      // encuentran por nombre O por correo
      valueGetter: (v, row) => `${row.customer_name ?? ''} ${row.customer_email ?? ''}`.trim(),
      renderCell: (params) => (
        <Box
          sx={{
            height: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <Typography variant="body2" noWrap sx={{ lineHeight: 1.4 }}>
            {params.row.customer_name ?? '—'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4 }} noWrap>
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
      field: 'delivery_method',
      headerName: 'Entrega',
      width: 110,
      valueGetter: (v) => (v === 'pickup' ? 'CDMX' : 'Envío'),
    },
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
          action={canUpdate && <ShippingToggle />}
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
