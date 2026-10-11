import { mutate } from 'swr';
import { useState } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Menu from '@mui/material/Menu';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import ToggleButton from '@mui/material/ToggleButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import useMediaQuery from '@mui/material/useMediaQuery';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';

import { fCurrency } from 'src/utils/format-number';

import { endpoints } from 'src/lib/axios';
import { useGetAnimals } from 'src/actions/animal';
import { DashboardContent } from 'src/layouts/dashboard';
import {
  createDelivery,
  deleteDelivery,
  updateDelivery,
  useGetDeliveries,
  setDeliveryStatus,
} from 'src/actions/delivery';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

import { DeliveryTotals } from '../delivery-totals';

// ----------------------------------------------------------------------
// Entregas: control de las entregas en persona (Metro) y de los cambios.
// Arriba las pendientes agrupadas por día con su número, para no mezclar
// varias del mismo día; abajo el historial. Una venta del POS se puede ligar
// con su número, pero la entrega es solo registro: no toca inventario.
// ----------------------------------------------------------------------

const KIND = {
  sale: { label: 'Venta', color: 'info' },
  trade: { label: 'Cambio', color: 'secondary' },
};

const STATUS = {
  pending: { label: 'Pendiente', color: 'warning' },
  delivered: { label: 'Entregada', color: 'success' },
  cancelled: { label: 'Cancelada', color: 'default' },
};

const METHODS = { cash: 'Efectivo', transfer: 'Transferencia', other: 'Otro' };

const ymd = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const today = () => ymd(new Date());
const tomorrow = () => ymd(new Date(Date.now() + 86400000));

const fDay = (d) =>
  new Date(`${d}T12:00:00`).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

// 10 dígitos (o 52 + 10) → enlace de WhatsApp; otra cosa (@instagram) se muestra tal cual
export const waLink = (contact) => {
  const digits = (contact ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `https://wa.me/52${digits}`;
  if (digits.length === 12 && digits.startsWith('52')) return `https://wa.me/${digits}`;
  return null;
};

const itemsText = (items) =>
  (items ?? [])
    .map((i) => (i.quantity > 1 ? `${i.quantity} × ${i.description}` : i.description))
    .join(', ');

const animalTitle = (a) => {
  const sp =
    a.species?.common_name || [a.species?.genus?.name, a.species?.name].filter(Boolean).join(' ');
  const morphs = (a.morphs ?? []).map((m) => m.name).join(' ');
  return [sp, morphs, a.code].filter(Boolean).join(' ');
};

// Pendientes → [{ key, label, color, rows }]; las atrasadas van juntas arriba
const groupByDay = (rows) => {
  const t = today();
  const m = tomorrow();
  const groups = new Map();
  rows.forEach((r) => {
    const key = r.scheduled_date < t ? 'late' : r.scheduled_date;
    if (!groups.has(key)) {
      const label =
        key === 'late' ? 'Atrasadas' : key === t ? 'Hoy' : key === m ? 'Mañana' : fDay(key);
      groups.set(key, {
        key,
        label,
        color: key === 'late' ? 'error' : key === t ? 'primary' : 'default',
        rows: [],
      });
    }
    groups.get(key).rows.push(r);
  });
  return [...groups.values()];
};

// ----------------------------------------------------------------------

const EMPTY_ITEM = { description: '', quantity: '1', animal_id: null };

const emptyForm = () => ({
  kind: 'sale',
  status: 'pending',
  buyer_name: '',
  buyer_contact: '',
  scheduled_date: today(),
  scheduled_time: '',
  place: '',
  items_given: [{ ...EMPTY_ITEM }],
  items_received: [],
  amount: '',
  paid: false,
  payment_method: '',
  sale_id: '',
  order_id: null,
  notes: '',
});

const fromDelivery = (d) => ({
  ...emptyForm(),
  ...Object.fromEntries(Object.keys(emptyForm()).map((k) => [k, d[k] ?? emptyForm()[k]])),
  items_given: (d.items_given ?? []).map((i) => ({ ...i, quantity: String(i.quantity) })),
  items_received: (d.items_received ?? []).map((i) => ({ ...i, quantity: String(i.quantity) })),
  amount: d.amount == null ? '' : String(d.amount),
  sale_id: d.sale_id == null ? '' : String(d.sale_id),
});

const cleanItems = (items, withAnimal) =>
  items
    .filter((i) => i.description.trim())
    .map((i) => ({
      description: i.description.trim(),
      quantity: Math.max(1, Number(i.quantity) || 1),
      ...(withAnimal ? { animal_id: i.animal_id ?? null } : {}),
    }));

const toPayload = (f) => ({
  kind: f.kind,
  status: f.status,
  buyer_name: f.buyer_name.trim(),
  buyer_contact: f.buyer_contact.trim() || null,
  scheduled_date: f.scheduled_date,
  scheduled_time: f.scheduled_time || null,
  place: f.place.trim() || null,
  items_given: cleanItems(f.items_given, true),
  items_received: f.kind === 'trade' ? cleanItems(f.items_received, false) : [],
  amount: f.amount === '' ? null : Number(f.amount),
  paid: f.paid,
  payment_method: f.payment_method || null,
  sale_id: f.sale_id === '' ? null : Number(f.sale_id),
  order_id: f.order_id ?? null,
  notes: f.notes.trim() || null,
});

// ----------------------------------------------------------------------

function ItemRows({ title, items, onChange, animals, addLabel }) {
  const setItem = (i, patch) =>
    onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Stack spacing={1.5}>
        {items.map((it, i) => (
          <Stack key={i} direction="row" spacing={1} alignItems="center">
            {animals ? (
              <Autocomplete
                freeSolo
                size="small"
                options={animals}
                getOptionLabel={(o) => (typeof o === 'string' ? o : animalTitle(o))}
                inputValue={it.description}
                onInputChange={(_, v, reason) => {
                  if (reason === 'input' || reason === 'clear')
                    setItem(i, { description: v, animal_id: null });
                }}
                onChange={(_, o) => {
                  if (o && typeof o !== 'string')
                    setItem(i, { description: animalTitle(o), animal_id: o.id });
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Qué" placeholder="Escribe o elige un ejemplar" />
                )}
                sx={{ flex: 1 }}
              />
            ) : (
              <TextField
                size="small"
                label="Qué"
                value={it.description}
                onChange={(e) => setItem(i, { description: e.target.value })}
                sx={{ flex: 1 }}
              />
            )}
            <TextField
              size="small"
              type="number"
              label="Cant."
              value={it.quantity}
              onChange={(e) => setItem(i, { quantity: e.target.value })}
              slotProps={{ htmlInput: { min: 1 } }}
              sx={{ width: 80 }}
            />
            <IconButton
              aria-label="Quitar"
              color="error"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <Iconify icon="solar:trash-bin-trash-bold" />
            </IconButton>
          </Stack>
        ))}
        <Button
          size="small"
          startIcon={<Iconify icon="mingcute:add-line" />}
          onClick={() => onChange([...items, { ...EMPTY_ITEM }])}
          sx={{ alignSelf: 'flex-start' }}
        >
          {addLabel}
        </Button>
      </Stack>
    </Box>
  );
}

function DeliveryDialog({ current, places, onClose, onSaved }) {
  const fullScreen = useMediaQuery((t) => t.breakpoints.down('sm'));
  const [form, setForm] = useState(() => (current ? fromDelivery(current) : emptyForm()));
  const [saving, setSaving] = useState(false);
  const { animals } = useGetAnimals({ page: 1, pageSize: 100, status: 'available' });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    const body = toPayload(form);
    if (!body.buyer_name) return toast.error('Pon el nombre del comprador');
    if (!body.scheduled_date) return toast.error('Pon la fecha');
    if (!body.items_given.length) return toast.error('Anota qué entregas');
    setSaving(true);
    try {
      if (current) await updateDelivery(current.id, body);
      else await createDelivery(body);
      toast.success(current ? 'Entrega actualizada' : 'Entrega guardada');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
    return null;
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
      <DialogTitle>{current ? 'Editar entrega' : 'Nueva entrega'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={form.kind}
            onChange={(_, v) => v && setForm((f) => ({ ...f, kind: v }))}
          >
            <ToggleButton value="sale">Venta</ToggleButton>
            <ToggleButton value="trade">Cambio</ToggleButton>
          </ToggleButtonGroup>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                required
                label="Comprador"
                value={form.buyer_name}
                onChange={set('buyer_name')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="WhatsApp o Instagram"
                value={form.buyer_contact}
                onChange={set('buyer_contact')}
              />
            </Grid>
            <Grid size={{ xs: 7, sm: 3 }}>
              <TextField
                fullWidth
                required
                type="date"
                label="Fecha"
                value={form.scheduled_date}
                onChange={set('scheduled_date')}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 5, sm: 3 }}>
              <TextField
                fullWidth
                type="time"
                label="Hora"
                value={form.scheduled_time}
                onChange={set('scheduled_time')}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Autocomplete
                freeSolo
                options={places}
                inputValue={form.place}
                onInputChange={(_, v) => setForm((f) => ({ ...f, place: v }))}
                renderInput={(params) => (
                  <TextField {...params} label="Lugar" placeholder="Metro …" />
                )}
              />
            </Grid>
          </Grid>

          <ItemRows
            title="Qué entrego"
            items={form.items_given}
            animals={animals}
            addLabel="Agregar"
            onChange={(items) => setForm((f) => ({ ...f, items_given: items }))}
          />

          {form.kind === 'trade' && (
            <ItemRows
              title="Qué me dan"
              items={form.items_received}
              addLabel="Agregar lo que recibo"
              onChange={(items) => setForm((f) => ({ ...f, items_received: items }))}
            />
          )}

          <Divider />

          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                fullWidth
                type="number"
                label={form.kind === 'trade' ? 'Diferencia a cobrar' : 'Por cobrar'}
                value={form.amount}
                onChange={set('amount')}
                slotProps={{
                  htmlInput: { min: 0, step: 1 },
                  input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                select
                fullWidth
                label="Pago"
                value={form.payment_method}
                onChange={set('payment_method')}
              >
                <MenuItem value="">—</MenuItem>
                {Object.entries(METHODS).map(([v, l]) => (
                  <MenuItem key={v} value={v}>
                    {l}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.paid}
                    onChange={(e) => setForm((f) => ({ ...f, paid: e.target.checked }))}
                  />
                }
                label="Ya pagó"
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                fullWidth
                type="number"
                label="Venta del POS #"
                value={form.sale_id}
                onChange={set('sale_id')}
                slotProps={{ htmlInput: { min: 1 } }}
              />
            </Grid>
          </Grid>

          <TextField
            multiline
            minRows={2}
            label="Notas"
            value={form.notes}
            onChange={set('notes')}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="contained" loading={saving} onClick={handleSave}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

function Contact({ value }) {
  if (!value) return null;
  const href = waLink(value);
  return href ? (
    <Link href={href} target="_blank" rel="noopener noreferrer" variant="body2">
      {value}
    </Link>
  ) : (
    <Typography variant="body2" component="span" color="text.secondary">
      {value}
    </Typography>
  );
}

function Money({ d }) {
  if (d.amount == null && !d.payment_method) return null;
  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
      {d.amount != null && <Typography variant="subtitle2">{fCurrency(d.amount)}</Typography>}
      <Label color={d.paid ? 'success' : 'warning'}>{d.paid ? 'Pagado' : 'Por cobrar'}</Label>
      {d.payment_method && (
        <Typography variant="caption" color="text.secondary">
          {METHODS[d.payment_method]}
        </Typography>
      )}
    </Stack>
  );
}

function PendingCard({ d, n, canEdit, canDelete, onDelivered, onEdit, onCancel, onDelete }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box
          sx={{
            minWidth: 32,
            height: 32,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'action.selected',
            typography: 'subtitle2',
          }}
        >
          {n}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {d.scheduled_time && <Typography variant="subtitle1">{d.scheduled_time}</Typography>}
            <Typography variant="subtitle1">{d.buyer_name}</Typography>
            <Label color={KIND[d.kind]?.color}>{KIND[d.kind]?.label}</Label>
          </Stack>
          <Contact value={d.buyer_contact} />
          {d.place && (
            <Typography variant="body2" color="text.secondary">
              {d.place}
            </Typography>
          )}
          <Typography variant="body2" sx={{ mt: 1 }}>
            <b>Entrego:</b> {itemsText(d.items_given) || '—'}
          </Typography>
          {d.kind === 'trade' && (
            <Typography variant="body2">
              <b>Recibo:</b> {itemsText(d.items_received) || '—'}
            </Typography>
          )}
          <Box sx={{ mt: 1 }}>
            <Money d={d} />
          </Box>
          {d.notes && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 1, whiteSpace: 'pre-line' }}
            >
              {d.notes}
            </Typography>
          )}
        </Box>
      </Stack>
      {canEdit && (
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button
            fullWidth
            size="large"
            variant="contained"
            color="success"
            startIcon={<Iconify icon="solar:check-circle-bold" />}
            onClick={() => onDelivered(d)}
          >
            Entregada
          </Button>
          <Button size="large" variant="outlined" onClick={() => onEdit(d)}>
            Editar
          </Button>
          <IconButton aria-label="Más opciones" onClick={(e) => setAnchor(e.currentTarget)}>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
          <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
            <MenuItem
              onClick={() => {
                setAnchor(null);
                onCancel(d);
              }}
            >
              Cancelar entrega
            </MenuItem>
            {canDelete && (
              <MenuItem
                sx={{ color: 'error.main' }}
                onClick={() => {
                  setAnchor(null);
                  onDelete(d);
                }}
              >
                Borrar
              </MenuItem>
            )}
          </Menu>
        </Stack>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------

export function DeliveryListView() {
  const { user } = useAuthContext();
  const canEdit = user?.permissions?.includes('sales.create');
  const canDelete = user?.permissions?.includes('sales.update');

  const [dialog, setDialog] = useState(null); // { current } | null

  const [histStatus, setHistStatus] = useState('delivered');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // ponytail: hasta 200 pendientes en una página; paginar si algún día hay más
  const pending = useGetDeliveries({ status: 'pending', pageSize: 200 });
  const history = useGetDeliveries({
    status: histStatus,
    q,
    page: page + 1,
    pageSize: rowsPerPage,
  });

  const refresh = () => {
    pending.deliveriesMutate();
    history.deliveriesMutate();
    // los totales viven en su propia tarjeta (con su mes elegido)
    mutate((key) => Array.isArray(key) && key[0] === endpoints.delivery.summary);
  };

  const places = [
    ...new Set([...pending.deliveries, ...history.deliveries].map((d) => d.place).filter(Boolean)),
  ];

  const changeStatus = async (d, status) => {
    try {
      await setDeliveryStatus(d.id, status);
      toast.success(status === 'delivered' ? `Entregada a ${d.buyer_name}` : 'Entrega cancelada');
      refresh();
    } catch (error) {
      toast.error(error?.message || 'No se pudo actualizar');
    }
  };

  const handleDelete = async (d) => {
    if (!window.confirm(`¿Borrar la entrega de ${d.buyer_name}?`)) return;
    try {
      await deleteDelivery(d.id);
      refresh();
    } catch (error) {
      toast.error(error?.message || 'No se pudo borrar');
    }
  };

  const groups = groupByDay(pending.deliveries);

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Entregas"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Ventas', href: paths.dashboard.sale.root },
          { name: 'Entregas' },
        ]}
        action={
          canEdit && (
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => setDialog({ current: null })}
            >
              Nueva entrega
            </Button>
          )
        }
        sx={{ mb: 3 }}
      />

      <DeliveryTotals />

      <Typography variant="h6" sx={{ mb: 2 }}>
        Pendientes
      </Typography>

      {!pending.deliveriesLoading && !groups.length && (
        <Card sx={{ p: 3, mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            No hay entregas pendientes.
          </Typography>
        </Card>
      )}

      <Stack spacing={3} sx={{ mb: 4 }}>
        {groups.map((g) => (
          <Box key={g.key}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  textTransform: 'capitalize',
                  color: g.color === 'error' ? 'error.main' : 'text.primary',
                }}
              >
                {g.label}
              </Typography>
              <Label color={g.color}>
                {g.rows.length} {g.rows.length === 1 ? 'entrega' : 'entregas'}
              </Label>
            </Stack>
            <Grid container spacing={2}>
              {g.rows.map((d, i) => (
                <Grid key={d.id} size={{ xs: 12, md: 6 }}>
                  <PendingCard
                    d={d}
                    n={i + 1}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onDelivered={(x) => changeStatus(x, 'delivered')}
                    onCancel={(x) => changeStatus(x, 'cancelled')}
                    onEdit={(x) => setDialog({ current: x })}
                    onDelete={handleDelete}
                  />
                  {g.key === 'late' && (
                    <Typography variant="caption" color="error.main">
                      Era para el {fDay(d.scheduled_date)}
                    </Typography>
                  )}
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}
      </Stack>

      <Card>
        <CardHeader title="Historial" />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          sx={{ px: 3, pt: 1 }}
        >
          <Tabs
            value={histStatus}
            onChange={(_, v) => {
              setHistStatus(v);
              setPage(0);
            }}
          >
            <Tab value="delivered" label="Entregadas" />
            <Tab value="cancelled" label="Canceladas" />
            <Tab value="" label="Todas" />
          </Tabs>
          <TextField
            size="small"
            placeholder="Buscar comprador, contacto o lugar"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setQ(qInput.trim());
                setPage(0);
              }
            }}
            onBlur={() => {
              setQ(qInput.trim());
              setPage(0);
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ width: { sm: 320 } }}
          />
        </Stack>

        <TableContainer sx={{ mt: 2 }}>
          <Scrollbar>
            <Table size="small" sx={{ minWidth: 860 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Comprador</TableCell>
                  <TableCell>Entregué / recibí</TableCell>
                  <TableCell>Cobro</TableCell>
                  <TableCell>Estado</TableCell>
                  {canEdit && <TableCell />}
                </TableRow>
              </TableHead>
              <TableBody>
                {history.deliveries.map((d) => (
                  <TableRow key={d.id} hover sx={{ verticalAlign: 'top' }}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {fDay(d.scheduled_date)}
                      {d.scheduled_time && ` · ${d.scheduled_time}`}
                      {d.place && (
                        <Typography variant="caption" component="div" color="text.secondary">
                          {d.place}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>{d.buyer_name}</div>
                      <Contact value={d.buyer_contact} />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Label color={KIND[d.kind]?.color} sx={{ mb: 0.5 }}>
                        {KIND[d.kind]?.label}
                      </Label>
                      <Typography variant="body2">{itemsText(d.items_given)}</Typography>
                      {d.kind === 'trade' && d.items_received?.length > 0 && (
                        <Typography variant="body2" color="text.secondary">
                          ← {itemsText(d.items_received)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Money d={d} />
                    </TableCell>
                    <TableCell>
                      <Label color={STATUS[d.status]?.color}>{STATUS[d.status]?.label}</Label>
                    </TableCell>
                    {canEdit && (
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {d.status !== 'pending' && (
                          <Button size="small" onClick={() => changeStatus(d, 'pending')}>
                            Regresar a pendiente
                          </Button>
                        )}
                        <IconButton aria-label="Editar" onClick={() => setDialog({ current: d })}>
                          <Iconify icon="solar:pen-bold" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>

        {!history.deliveriesLoading && !history.deliveries.length && (
          <EmptyContent title="Sin entregas" sx={{ py: 6 }} />
        )}

        <TablePagination
          component="div"
          count={history.deliveriesTotal}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[25, 50, 100]}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setPage(0);
          }}
          labelRowsPerPage="Por página"
        />
      </Card>

      {dialog && (
        <DeliveryDialog
          current={dialog.current}
          places={places}
          onClose={() => setDialog(null)}
          onSaved={refresh}
        />
      )}
    </DashboardContent>
  );
}
