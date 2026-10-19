import { mutate } from 'swr';
import { useState } from 'react';

import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';

import { endpoints } from 'src/lib/axios';
import { moveAnimal } from 'src/actions/animal';

import { toast } from 'src/components/snackbar';

import { PURPOSES, purposeOf, PURPOSE_HELP, PURPOSE_LABELS, moveBlockReason } from './utils';

// ----------------------------------------------------------------------

export function MoveAnimalDialog({ animal, species, target, open, onClose, onMoved }) {
  const [all, setAll] = useState(false);
  const [quantity, setQuantity] = useState('');
  // Precio a la vista: nada sale a la venta con un precio que no se vio
  const initialPrice = Number(animal.price) > 0 ? String(animal.price) : '';
  const [price, setPrice] = useState(initialPrice);
  const [saving, setSaving] = useState(false);

  const bulk = species?.sale_format === 'package' || species?.sale_format === 'colony';
  // Un paquete se cuenta en paquetes si el origen o el destino es venta
  const inPackages =
    species?.sale_format === 'package' && (purposeOf(animal) === 'sale' || target === 'sale');
  // Al pasar de no-venta a venta el stock está en animales: caben floor(stock / tamaño) paquetes
  const fromAnimals = inPackages && purposeOf(animal) !== 'sale';
  const max = fromAnimals
    ? Math.floor(Number(animal.stock) / Number(species.package_size))
    : Number(animal.stock);
  const needsPrice = target === 'sale' && Number(animal.price) === 0;
  // Solo se manda si lo tecleó o hacía falta: no pisa el precio de un hermano
  const sendPrice = target === 'sale' && (needsPrice || price !== initialPrice);

  const qty = Number(quantity);
  const invalid =
    (bulk && !all && !(Number.isInteger(qty) && qty > 0 && qty <= max)) ||
    (sendPrice && !(Number(price) > 0));

  const handleMove = async () => {
    setSaving(true);
    try {
      const data = { purpose: target };
      if (bulk) data.quantity = all ? null : Number(quantity);
      if (sendPrice) data.price = Number(price);
      const moved = await moveAnimal(animal.id, data);
      toast.success(`Movido a ${PURPOSE_LABELS[target]}`);
      // Las demás pantallas (listas, ficha, POS) leen la caché de SWR
      mutate((key) => Array.isArray(key) && key[0] === endpoints.animal.list);
      mutate(endpoints.animal.details(animal.id));
      onMoved?.(moved);
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Mover a {PURPOSE_LABELS[target]}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {bulk && (
            <>
              <FormControlLabel
                control={<Checkbox checked={all} onChange={(e) => setAll(e.target.checked)} />}
                label="Todos"
              />
              <TextField
                disabled={all}
                type="number"
                label={inPackages ? '¿Cuántos paquetes?' : '¿Cuántos?'}
                helperText={
                  fromAnimals
                    ? `Hay ${max} ${max === 1 ? 'paquete' : 'paquetes'} (${animal.stock} animales)`
                    : `Hay ${animal.stock}`
                }
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                slotProps={{ htmlInput: { min: 1, max, step: 1 } }}
              />
            </>
          )}
          {target === 'sale' && (
            <TextField
              required={needsPrice}
              type="number"
              label="Precio de venta"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              slotProps={{ htmlInput: { min: 0 } }}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={invalid || saving} onClick={handleMove}>
          Mover
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

const MENU_ITEMS = {
  sale: 'Poner en venta',
  breeder: 'Pasar a pie de cría',
  growing: 'Pasar a crianza',
};

export function MoveAnimalMenu({ animal, species, onMoved }) {
  const [anchor, setAnchor] = useState(null);
  const [target, setTarget] = useState(null);
  const blocked = moveBlockReason(animal);

  return (
    <>
      <Button size="small" variant="outlined" onClick={(e) => setAnchor(e.currentTarget)}>
        Mover a…
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {PURPOSES.filter((p) => p !== purposeOf(animal)).map((p) => (
          <MenuItem
            key={p}
            disabled={!!blocked}
            onClick={() => {
              setAnchor(null);
              setTarget(p);
            }}
          >
            <ListItemText primary={MENU_ITEMS[p]} secondary={blocked ?? PURPOSE_HELP[p]} />
          </MenuItem>
        ))}
      </Menu>
      {target && (
        <MoveAnimalDialog
          open
          animal={animal}
          species={species}
          target={target}
          onClose={() => setTarget(null)}
          onMoved={onMoved}
        />
      )}
    </>
  );
}
