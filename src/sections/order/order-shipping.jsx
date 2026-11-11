import { useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { fCurrency } from 'src/utils/format-number';

import {
  quoteShipment,
  createShipment,
  quoteOrderShipping,
  createOrderShippingLabel,
} from 'src/actions/order';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// Guía de envío con Envia.com. Herramienta interna: quien atiende el pedido
// revisa la dirección, mide el paquete, cotiza y decide cuándo generar la guía.
// ----------------------------------------------------------------------

// Mismos nombres que usa el sitio al capturar la dirección (MX_STATES en el API)
const MX_STATES = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
  'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México',
  'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit',
  'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
  'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán',
  'Zacatecas',
]; // prettier-ignore

const DESTINATION_FIELDS = [
  { name: 'name', label: 'Destinatario', width: 7 },
  { name: 'phone', label: 'Teléfono (10 dígitos)', width: 5 },
  { name: 'street', label: 'Calle', width: 6 },
  { name: 'number', label: 'Número', width: 2 },
  { name: 'district', label: 'Colonia', width: 4 },
  { name: 'postal_code', label: 'CP', width: 2 },
  { name: 'city', label: 'Ciudad o municipio', width: 5 },
  { name: 'state', label: 'Estado', width: 5, options: MX_STATES },
  { name: 'reference', label: 'Referencias', width: 12 },
];

const PACKAGE_FIELDS = [
  { name: 'content', label: 'Contenido', width: 12 },
  { name: 'weight', label: 'Peso (kg)', width: 3, number: true },
  { name: 'length', label: 'Largo (cm)', width: 3, number: true },
  { name: 'width', label: 'Ancho (cm)', width: 3, number: true },
  { name: 'height', label: 'Alto (cm)', width: 3, number: true },
];

// En un pedido el valor declarado es su total; en un envío suelto se captura
const DECLARED_VALUE_FIELD = {
  name: 'declared_value',
  label: 'Valor declarado ($)',
  width: 4,
  number: true,
};

const REQUIRED = ['name', 'phone', 'street', 'postal_code', 'city', 'state'];

function Fields({ fields, values, onChange }) {
  return (
    <Box sx={{ gap: 2, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)' }}>
      {fields.map((field) => (
        <TextField
          key={field.name}
          size="small"
          select={!!field.options}
          label={field.label}
          value={values[field.name]}
          type={field.number ? 'number' : 'text'}
          onChange={(e) => onChange(field.name, e.target.value)}
          sx={{ gridColumn: { xs: 'span 12', sm: `span ${field.width}` } }}
        >
          {field.options?.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
      ))}
    </Box>
  );
}

// Sin `order` es un envío suelto: no sale de un pedido del sitio (una venta
// por WhatsApp, un regalo) y no depende de «Aceptar envíos».
export function ShippingDialog({ order, onClose, onUpdated }) {
  const address = order?.customer_address ?? {};
  // Envío suelto: la clave nace con el formulario, así dos clics en «Generar
  // guía» (o un reintento tras un error de red) no compran dos guías
  const shipmentKey = useRef(
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const [note, setNote] = useState('');
  const [destination, setDestination] = useState({
    name: order?.contact_name ?? order?.customer_name ?? '',
    phone: (order?.contact_phone ?? '').replace(/\D/g, '').slice(-10),
    street: address.street ?? '',
    number: [address.ext_number, address.int_number && `Int. ${address.int_number}`]
      .filter(Boolean)
      .join(' '),
    district: address.neighborhood ?? '',
    postal_code: address.zip_code ?? '',
    city: address.city ?? '',
    state: MX_STATES.includes(address.state) ? address.state : '',
    reference: address.address_notes ?? '',
  });
  const [pack, setPack] = useState({
    content: order?.items.map((item) => item.title).join(', ').slice(0, 100) ?? '',
    weight: '',
    length: '',
    width: '',
    height: '',
    declared_value: '',
  });
  const [rates, setRates] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [busy, setBusy] = useState(false);

  // Cambiar dirección o paquete invalida la cotización: el precio ya no aplica
  const edit = (setter) => (name, value) => {
    setter((prev) => ({ ...prev, [name]: value }));
    setRates(null);
    setChosen(null);
  };

  const body = () => ({
    destination: Object.fromEntries(
      Object.entries(destination).map(([key, value]) => [key, value.trim() || null])
    ),
    package: {
      content: pack.content.trim(),
      weight: Number(pack.weight),
      length: Number(pack.length),
      width: Number(pack.width),
      height: Number(pack.height),
      declared_value: Number(order ? order.total : pack.declared_value) || 0,
    },
  });

  const ready =
    REQUIRED.every((name) => destination[name].trim()) &&
    pack.content.trim() &&
    ['weight', 'length', 'width', 'height'].every((name) => Number(pack[name]) > 0);

  const handleQuote = async () => {
    setBusy(true);
    try {
      const res = await (order ? quoteOrderShipping(order.id, body()) : quoteShipment(body()));
      setRates(res.rates);
      setChosen(null);
    } catch (error) {
      toast.error(error?.message || 'No se pudo cotizar');
    } finally {
      setBusy(false);
    }
  };

  const handleLabel = async () => {
    setBusy(true);
    try {
      const data = { ...body(), carrier: chosen.carrier, service: chosen.service };
      const updated = await (order
        ? createOrderShippingLabel(order.id, data)
        : createShipment({ ...data, idempotency_key: shipmentKey.current, note: note.trim() || null }));
      toast.success(`Guía ${updated.tracking_number} generada`);
      await onUpdated(updated);
      onClose();
    } catch (error) {
      toast.error(error?.message || 'No se pudo generar la guía');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open fullWidth maxWidth="md" onClose={busy ? undefined : onClose}>
      <DialogTitle>
        {order ? `Envío del pedido ${order.code ?? `#${order.id}`}` : 'Envío nuevo'}
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
        {!order && (
          <TextField
            size="small"
            label="¿De qué es este envío?"
            placeholder="Pedido por WhatsApp de Juan"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 250 } }}
            sx={{ mt: 1 }}
          />
        )}

        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Destino
        </Typography>
        <Fields fields={DESTINATION_FIELDS} values={destination} onChange={edit(setDestination)} />

        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Paquete ya empacado
        </Typography>
        <Fields
          fields={order ? PACKAGE_FIELDS : [...PACKAGE_FIELDS, DECLARED_VALUE_FIELD]}
          values={pack}
          onChange={edit(setPack)}
        />

        {rates?.length === 0 && (
          <Alert severity="warning">
            Ninguna paquetería cotizó este envío. Revisa el código postal, el estado y las
            medidas.
          </Alert>
        )}

        {rates?.length > 0 && (
          <Stack spacing={1}>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              Elige paquetería
            </Typography>
            {rates.map((rate) => {
              const active = chosen === rate;
              return (
                <Box
                  key={`${rate.carrier}-${rate.service}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setChosen(rate)}
                  onKeyDown={(e) => e.key === 'Enter' && setChosen(rate)}
                  sx={{
                    p: 1.5,
                    gap: 2,
                    display: 'flex',
                    cursor: 'pointer',
                    borderRadius: 1,
                    alignItems: 'center',
                    border: (theme) =>
                      `solid 1px ${active ? theme.vars.palette.primary.main : theme.vars.palette.divider}`,
                    bgcolor: active ? 'action.selected' : 'transparent',
                  }}
                >
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ textTransform: 'uppercase' }}>
                      {rate.carrier}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {[rate.description, rate.delivery_estimate].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                  <Typography variant="subtitle1">{fCurrency(rate.price)}</Typography>
                </Box>
              );
            })}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button color="inherit" disabled={busy} onClick={onClose}>
          Cerrar
        </Button>
        <Button variant="outlined" loading={busy && !chosen} disabled={!ready} onClick={handleQuote}>
          {rates ? 'Volver a cotizar' : 'Cotizar'}
        </Button>
        <Button variant="contained" loading={busy && !!chosen} disabled={!chosen} onClick={handleLabel}>
          {chosen ? `Generar guía · ${fCurrency(chosen.price)}` : 'Generar guía'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

export function OrderShipping({ order, canUpdate, onUpdated }) {
  const [open, setOpen] = useState(false);

  if (order.tracking_number) {
    return (
      <Box sx={{ gap: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ textTransform: 'uppercase' }}>
            {order.shipping_carrier} · {order.tracking_number}
          </Typography>
          {order.shipping_cost != null && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Guía pagada: {fCurrency(order.shipping_cost)}
            </Typography>
          )}
        </Box>
        {order.label_url && (
          <Button
            size="small"
            variant="outlined"
            href={order.label_url}
            target="_blank"
            rel="noopener"
            startIcon={<Iconify icon="solar:printer-minimalistic-bold" width={16} />}
          >
            Imprimir guía
          </Button>
        )}
        {order.tracking_url && (
          <Button size="small" color="inherit" href={order.tracking_url} target="_blank" rel="noopener">
            Rastrear
          </Button>
        )}
      </Box>
    );
  }

  if (!canUpdate || order.status === 'cancelled') return null;

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<Iconify icon="mingcute:add-line" />}
        onClick={() => setOpen(true)}
        sx={{ alignSelf: 'flex-start' }}
      >
        Cotizar envío
      </Button>

      {open && <ShippingDialog order={order} onClose={() => setOpen(false)} onUpdated={onUpdated} />}
    </>
  );
}
