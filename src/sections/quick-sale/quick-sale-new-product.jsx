import { useState } from 'react';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { fCurrency } from 'src/utils/format-number';

import { toNumber } from './quick-sale-math';

// ----------------------------------------------------------------------

// Producto de último momento: algo que nadie dio de alta. Se guarda en el
// equipo (funciona sin internet) y se da de alta en el sistema al subir sus
// ventas; después se revisa en Productos → «Por revisar».
export function QuickSaleNewProduct({
  initialTitle = '',
  suppliers = [],
  removable = [],
  onCreate,
  onRemove,
  onClose,
}) {
  const [title, setTitle] = useState(initialTitle);
  const [price, setPrice] = useState('');
  const [needsPrep, setNeedsPrep] = useState(false);
  const [owner, setOwner] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const amount = toNumber(price);
    const next = {
      title: title.trim() ? null : 'Escribe el nombre',
      price: Number.isFinite(amount) && amount > 0 ? null : 'Escribe un precio mayor a cero',
    };
    setErrors(next);
    if (next.title || next.price || saving) return;
    setSaving(true);
    try {
      await onCreate({
        title: title.trim(),
        price_retail: Math.round(amount * 100) / 100,
        needs_prep: needsPrep,
        consignor_id: owner === '' ? null : owner,
      });
    } finally {
      setSaving(false);
    }
  };

  const onEnter = (e) => e.key === 'Enter' && submit();

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Producto temporal</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Solo para cobrar ahora (también sin internet). No entra al catálogo de la tienda:
            después lo completas o lo desechas en Productos → «Por revisar».
          </Typography>
          <TextField
            autoFocus
            label="Nombre"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={onEnter}
            error={Boolean(errors.title)}
            helperText={errors.title}
            slotProps={{ htmlInput: { maxLength: 250 } }}
          />
          <TextField
            label="Precio"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={onEnter}
            error={Boolean(errors.price)}
            helperText={errors.price}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
          {suppliers.length > 0 && (
            <TextField
              select
              label="De quién es"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            >
              <MenuItem value="">Propio</MenuItem>
              {suppliers.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          <FormControlLabel
            control={
              <Checkbox checked={needsPrep} onChange={(e) => setNeedsPrep(e.target.checked)} />
            }
            label="Se prepara al momento (imprime orden)"
          />

          {removable.length > 0 && (
            <Stack spacing={0.5}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Creados en este equipo y aún sin ventas
              </Typography>
              {removable.map((item) => (
                <Stack
                  key={item.client_key}
                  direction="row"
                  sx={{ gap: 1, alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Typography variant="body2">
                    {item.title} · {fCurrency(item.price_retail)}
                  </Typography>
                  <Button size="small" color="error" onClick={() => onRemove(item)}>
                    Quitar
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        <Button variant="contained" loading={saving} onClick={submit}>
          Agregar a la cuenta
        </Button>
      </DialogActions>
    </Dialog>
  );
}
