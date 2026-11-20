import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import ToggleButton from '@mui/material/ToggleButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { fCurrency } from 'src/utils/format-number';

import { priced, toNumber, lineTotals, namedSplit } from './quick-sale-math';

// ----------------------------------------------------------------------

export const METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
];

const stepSx = { minWidth: 48, minHeight: 48, px: 0, fontSize: 22, lineHeight: 1 };

// Descuento de una línea (pesos o %) o de toda la cuenta (solo %)
function DiscountDialog({ target, quick, onClose }) {
  const whole = target === 'all';
  const [unit, setUnit] = useState(whole ? 'percent' : 'amount');
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);

  const line = whole ? null : quick.cart.find((l) => l.product_id === target);
  const item = whole ? null : priced(quick.itemsById.get(target), line);

  const apply = () => {
    const number = toNumber(value);
    if (!Number.isFinite(number) || number < 0) {
      setError('Escribe una cantidad válida');
      return;
    }
    if (unit === 'percent' && number > 100) {
      setError('El porcentaje no puede pasar de 100');
      return;
    }
    if (whole) {
      const unapplied = quick.discountAll(number);
      if (unapplied > 0) {
        setError(
          `${fCurrency(unapplied)} no se aplicaron: algunos productos tienen un descuento máximo.`
        );
        return;
      }
      onClose();
      return;
    }
    const amount =
      unit === 'percent'
        ? Math.round(Number(item.price_retail) * line.quantity * number) / 100
        : number;
    const message = quick.setDiscount(target, amount);
    if (message) setError(message);
    else onClose();
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {whole ? 'Descuento a la cuenta' : `Descuento · ${item?.title ?? ''}`}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {!whole && (
            <ToggleButtonGroup
              exclusive
              fullWidth
              value={unit}
              onChange={(_, next) => next && setUnit(next)}
            >
              <ToggleButton value="amount">En pesos</ToggleButton>
              <ToggleButton value="percent">En porcentaje</ToggleButton>
            </ToggleButtonGroup>
          )}
          <TextField
            autoFocus
            label="Descuento"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && apply()}
            error={Boolean(error)}
            helperText={error ?? (unit === 'percent' ? 'Porcentaje, de 0 a 100' : 'Pesos')}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        <Button variant="contained" onClick={apply}>
          Aplicar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Precio al vuelo de una línea (solo admin): se cobra a ese precio; si se
// vuelve el precio del producto se decide después, en «Precios cambiados»
function PriceDialog({ productId, quick, onClose }) {
  const line = quick.cart.find((l) => l.product_id === productId);
  const item = quick.itemsById.get(productId);
  const [value, setValue] = useState(() => String(Number(priced(item, line)?.price_retail ?? 0)));
  const [error, setError] = useState(null);

  const apply = () => {
    const message = quick.setPrice(productId, toNumber(value));
    if (message) setError(message);
    else onClose();
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Precio · {item?.title ?? ''}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            autoFocus
            label="Precio por pieza"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => e.key === 'Enter' && apply()}
            error={Boolean(error)}
            helperText={
              error ??
              `Solo para esta venta. En el sistema: ${fCurrency(item?.price_retail) || '$0'}`
            }
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        <Button variant="contained" onClick={apply}>
          Aplicar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

// canEditPrice: solo administradores cambian el precio al cobrar
export function QuickSaleCart({
  quick,
  charging,
  printTicket,
  onPrintTicketChange,
  onCharge,
  canEditPrice = false,
}) {
  const { cart, totals, itemsById } = quick;
  const [method, setMethod] = useState('cash');
  const [received, setReceived] = useState('');
  const [discountFor, setDiscountFor] = useState(null);
  const [priceFor, setPriceFor] = useState(null);

  const empty = cart.length === 0;
  // Solo si la cuenta mezcla productos de más de un dueño
  const split = namedSplit(cart, itemsById, quick.suppliers);
  const receivedNumber = toNumber(received);
  const short = method === 'cash' && received !== '' && receivedNumber < totals.total;

  const charge = async () => {
    const ok = await onCharge({ method });
    if (ok) setReceived('');
  };

  return (
    <Card component="section" aria-label="Cuenta" sx={{ p: 2 }}>
      <Typography variant="h6">Cuenta</Typography>

      {empty ? (
        <Typography variant="body2" sx={{ py: 4, color: 'text.secondary', textAlign: 'center' }}>
          Toca un producto para empezar
        </Typography>
      ) : (
        <Stack divider={<Divider sx={{ borderStyle: 'dashed' }} />} sx={{ mt: 1 }}>
          {cart.map((line) => {
            const catalogItem = itemsById.get(line.product_id);
            if (!catalogItem) return null;
            const item = priced(catalogItem, line);
            const repriced = item !== catalogItem;
            const { total } = lineTotals(item, line.quantity, line.discount);
            return (
              <Box key={line.product_id} sx={{ py: 1.25 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                  <Typography variant="subtitle2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {line.quantity}×
                  </Typography>
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {fCurrency(total)}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 0.75, alignItems: 'center' }}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    sx={stepSx}
                    aria-label={`Quitar uno de ${item.title}`}
                    onClick={() => quick.setQuantity(line.product_id, line.quantity - 1)}
                  >
                    −
                  </Button>
                  <Button
                    variant="outlined"
                    color="inherit"
                    sx={stepSx}
                    aria-label={`Agregar otro de ${item.title}`}
                    onClick={() => quick.add(item)}
                  >
                    +
                  </Button>
                  <Box sx={{ flexGrow: 1 }} />
                  {repriced && (
                    <Typography variant="caption" sx={{ color: 'warning.main' }}>
                      a {fCurrency(item.price_retail) || '$0'}
                    </Typography>
                  )}
                  {line.discount > 0 && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      −{fCurrency(line.discount)}
                    </Typography>
                  )}
                  {canEditPrice && (
                    <Button
                      size="small"
                      aria-label={`Precio de ${item.title}`}
                      onClick={() => setPriceFor(line.product_id)}
                    >
                      Precio
                    </Button>
                  )}
                  <Button size="small" onClick={() => setDiscountFor(line.product_id)}>
                    Descuento
                  </Button>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}

      <Divider sx={{ my: 1.5 }} />

      {totals.tax > 0 && (
        <Stack direction="row" sx={{ justifyContent: 'space-between', color: 'text.secondary' }}>
          <Typography variant="body2">Impuestos</Typography>
          <Typography variant="body2">{fCurrency(totals.tax)}</Typography>
        </Stack>
      )}
      <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Typography variant="subtitle1">Total</Typography>
        <Typography variant="h4" data-testid="total" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {fCurrency(totals.total) || '$0'}
        </Typography>
      </Stack>

      {split.length > 1 && (
        <Box sx={{ mt: 1, p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Reparto
          </Typography>
          <Stack component="ul" aria-label="Reparto" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {split.map((part) => (
              <Stack
                key={part.consignor_id ?? 'own'}
                component="li"
                direction="row"
                sx={{ gap: 2, justifyContent: 'space-between' }}
              >
                <Typography variant="body2">{part.name}</Typography>
                <Typography variant="subtitle2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fCurrency(part.total) || '$0'}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      )}

      <Button
        size="small"
        disabled={empty}
        onClick={() => setDiscountFor('all')}
        sx={{ mt: 0.5, alignSelf: 'flex-start' }}
      >
        Descuento a la cuenta
      </Button>

      <ToggleButtonGroup
        exclusive
        fullWidth
        value={method}
        onChange={(_, next) => next && setMethod(next)}
        aria-label="Método de pago"
        sx={{ mt: 2 }}
      >
        {METHODS.map((m) => (
          <ToggleButton key={m.value} value={m.value} sx={{ minHeight: 48 }}>
            {m.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {method === 'cash' && (
        <Stack direction="row" spacing={2} sx={{ mt: 2, alignItems: 'center' }}>
          <TextField
            label="Recibí"
            value={received}
            onChange={(e) => setReceived(e.target.value)}
            error={short}
            helperText={short ? 'Falta dinero' : ' '}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            sx={{ flex: 1 }}
          />
          <Box sx={{ flex: 1, pb: 2.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Cambio
            </Typography>
            <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {received !== '' && !short ? fCurrency(receivedNumber - totals.total) || '$0' : '—'}
            </Typography>
          </Box>
        </Stack>
      )}

      <FormControlLabel
        control={
          <Checkbox checked={printTicket} onChange={(e) => onPrintTicketChange(e.target.checked)} />
        }
        label="Imprimir ticket"
        sx={{ mt: method === 'cash' ? 0 : 1 }}
      />

      <Button
        fullWidth
        size="large"
        variant="contained"
        disabled={empty || short}
        loading={charging}
        onClick={charge}
        sx={{ mt: 1, minHeight: 56, fontSize: 18 }}
      >
        Cobrar {empty ? '' : fCurrency(totals.total)}
      </Button>

      {priceFor !== null && (
        <PriceDialog productId={priceFor} quick={quick} onClose={() => setPriceFor(null)} />
      )}
      {discountFor !== null && (
        <DiscountDialog target={discountFor} quick={quick} onClose={() => setDiscountFor(null)} />
      )}
    </Card>
  );
}
