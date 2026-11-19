import { useState } from 'react';

import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { fCurrency } from 'src/utils/format-number';
import { runInBatches } from 'src/utils/run-in-batches';
import { applyDiscount, removeDiscount, discountPercent } from 'src/utils/discount';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';

// ----------------------------------------------------------------------

// Precio en las listas: con descuento lleva el de antes tachado y el %
export function DiscountPrice({ price, compareAt }) {
  const percent = discountPercent(price, compareAt);
  if (!percent) return fCurrency(price);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 0.75 }}>
      <span>{fCurrency(price)}</span>
      <Box component="span" sx={{ color: 'text.disabled', textDecoration: 'line-through' }}>
        {fCurrency(compareAt)}
      </Box>
      <Label variant="soft" color="error">
        −{percent}%
      </Label>
    </Box>
  );
}

// items: [{ id, name, price, compare_at_price }]. onSave(item, { price,
// compare_at_price }) guarda uno; onDone refresca la lista.
export function BulkDiscountDialog({ open, items, onSave, onDone, onClose }) {
  const [percent, setPercent] = useState('');
  const [saving, setSaving] = useState(false);
  const [tens, setTens] = useState(false);

  const value = Number(percent);
  const valid = Number.isInteger(value) && value >= 1 && value <= 90;
  const planned = items.map((item) => ({
    item,
    patch: valid ? applyDiscount(item.price, item.compare_at_price, value, { tens }) : null,
  }));
  const toApply = planned.filter((p) => p.patch);
  const toRemove = items
    .map((item) => ({ item, patch: removeDiscount(item.price, item.compare_at_price) }))
    .filter((p) => p.patch);

  const run = async (changes, done) => {
    setSaving(true);
    const results = await runInBatches(changes, 5, ({ item, patch }) => onSave(item, patch));
    setSaving(false);
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length) {
      toast.error(
        failed.length === 1
          ? failed[0].reason?.message || 'No se pudo cambiar el precio'
          : `${failed.length} no se pudieron cambiar`
      );
    } else {
      toast.success(done);
    }
    onDone();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Descuento a {items.length === 1 ? '1 seleccionado' : `${items.length} seleccionados`}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          El precio de antes queda tachado en la tienda y la venta cobra el nuevo. Si alguno ya
          tenía descuento, se calcula sobre su precio de antes (no se acumula).
        </Typography>
        <TextField
          label="Descuento (%)"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          error={percent !== '' && !valid}
          helperText={percent !== '' && !valid ? 'De 1 a 90' : 'Por ejemplo 20'}
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          sx={{ maxWidth: 200 }}
          autoFocus
        />
        <FormControlLabel
          sx={{ ml: 1 }}
          control={<Checkbox checked={tens} onChange={(e) => setTens(e.target.checked)} />}
          label="Redondear a decenas"
        />
        <Table size="small" sx={{ mt: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Antes</TableCell>
              <TableCell>Con descuento</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {planned.map(({ item, patch }) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>
                  <DiscountPrice price={item.price} compareAt={item.compare_at_price} />
                </TableCell>
                <TableCell>
                  {patch ? fCurrency(patch.price) : valid ? 'Sin cambio' : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        <Button
          color="inherit"
          variant="outlined"
          disabled={!toRemove.length || saving}
          onClick={() => run(toRemove, 'Descuento quitado')}
        >
          Quitar descuento ({toRemove.length})
        </Button>
        <Button
          variant="contained"
          loading={saving}
          disabled={!toApply.length}
          onClick={() => run(toApply, `Descuento de ${value}% aplicado`)}
        >
          {valid ? `Aplicar −${value}%` : 'Aplicar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
