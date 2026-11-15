import { useMemo, useState } from 'react';

import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { updateProduct } from 'src/actions/product';
import {
  createAnimal,
  updateAnimal,
  useAllGenera,
  useAllSpecies,
  useAnimalGroupTree,
} from 'src/actions/animal';

import { toast } from 'src/components/snackbar';

import { VarietyPicker } from './variety-picker';
import { purposeOf, flattenGroupTree } from './utils';

// ----------------------------------------------------------------------

const isBulk = (species) => !!species?.sale_format && species.sale_format !== 'individual';

function quantityLabel(species) {
  if (species?.sale_format === 'colony') return '¿Cuántas cepas?';
  if (species?.sale_format === 'package') return `¿Cuántos paquetes de ${species.package_size}?`;
  return '¿Cuántos ejemplares?';
}

const sameMorphs = (animal, morphIds) => {
  const ids = (animal.morphs ?? []).map((m) => m.id);
  return ids.length === morphIds.length && ids.every((id) => morphIds.includes(id));
};

// «Poner en venta» en corto: especie, cuántos y precio. Lo demás (sexo, fotos,
// documentación, costo) queda con los valores por omisión y se completa
// después con «Editar». `animals`: los que ya hay, para que una cepa o paquete
// que ya está en venta sume existencias en vez de duplicarse.
export function PutOnSaleDialog({ initialSpecies = null, animals = [], onClose, onDone }) {
  const { species: allSpecies } = useAllSpecies();
  const { genera: allGenera } = useAllGenera();
  const { groupTree } = useAnimalGroupTree();
  const [species, setSpecies] = useState(initialSpecies);
  // Filtros para acortar la lista de especies (no se guardan en el animal)
  const [group, setGroup] = useState(null);
  const [genus, setGenus] = useState(null);
  const [morphIds, setMorphIds] = useState([]);
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [quickSale, setQuickSale] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => flattenGroupTree(groupTree), [groupTree]);
  // Un grupo padre trae también lo de sus subgrupos
  const groupIds = useMemo(
    () =>
      group
        ? groups.filter((g) => g.id === group.id || g.ancestors.includes(group.id)).map((g) => g.id)
        : null,
    [group, groups]
  );
  const inGroup = (genusLike) =>
    !groupIds || groupIds.includes(genusLike?.group?.id ?? genusLike?.group_id);
  const genusOptions = allGenera.filter(inGroup);
  const speciesOptions = allSpecies.filter(
    (s) => inGroup(s.genus) && (!genus || s.genus?.id === genus.id)
  );

  const bulk = isBulk(species);

  // Cepa o paquete que ya está en venta (misma especie y morphs): el servidor
  // no admite dos registros iguales, así que se le suman existencias
  const existing = bulk
    ? animals.find(
        (a) =>
          a.species?.id === species.id &&
          a.status === 'available' &&
          purposeOf(a) === 'sale' &&
          sameMorphs(a, morphIds)
      )
    : null;

  const submit = async () => {
    const amount = Number(String(quantity).trim());
    const value = Number(String(price).trim().replace(',', '.'));
    const next = {
      species: species ? null : 'Elige la especie',
      quantity:
        Number.isInteger(amount) && amount >= 1 && (bulk || amount <= 50)
          ? null
          : bulk
            ? 'Escribe cuántos (mínimo 1)'
            : 'Escribe cuántos (de 1 a 50)',
      // con existencias ya en venta el precio es opcional: se queda el que tiene
      price:
        (existing && String(price).trim() === '') || (Number.isFinite(value) && value > 0)
          ? null
          : 'Escribe un precio mayor a cero',
    };
    setErrors(next);
    if (next.species || next.quantity || next.price || saving) return;

    setSaving(true);
    try {
      if (existing) {
        await updateAnimal(existing.id, {
          stock: Number(existing.stock ?? 0) + amount,
          ...(String(price).trim() === '' ? {} : { price: value }),
        });
        if (quickSale) await updateProduct(existing.product_id, { quick_sale: true });
      } else {
        await createAnimal({
          species_id: species.id,
          purpose: 'sale',
          sex: 'unknown',
          price: value,
          price_cost: 0,
          morph_ids: morphIds,
          photos: [],
          ...(bulk ? { stock: amount } : amount > 1 ? { count: amount } : {}),
          quick_sale: quickSale,
        });
      }
      toast.success(existing ? 'Existencias agregadas' : 'Ya está en venta');
      onDone(species.id);
    } catch (error) {
      toast.error(error?.message || 'No se pudo poner en venta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Poner en venta</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {/* Abierto desde la fila de una especie ya no hay nada que buscar */}
          {!initialSpecies && (
            <Stack direction="row" spacing={2}>
              <Autocomplete
                size="small"
                options={groups}
                value={group}
                onChange={(_, option) => {
                  setGroup(option);
                  setGenus(null);
                  setSpecies(null);
                }}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, selected) => option.id === selected.id}
                renderOption={({ key, ...props }, option) => (
                  <li
                    key={key}
                    {...props}
                    style={{ ...props.style, paddingLeft: 16 + option.depth * 16 }}
                  >
                    {option.name}
                  </li>
                )}
                renderInput={(params) => <TextField {...params} label="Grupo" />}
                sx={{ flex: 1 }}
              />
              <Autocomplete
                size="small"
                options={genusOptions}
                value={genus}
                onChange={(_, option) => {
                  setGenus(option);
                  setSpecies(null);
                }}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, selected) => option.id === selected.id}
                renderInput={(params) => <TextField {...params} label="Género" />}
                sx={{ flex: 1 }}
              />
            </Stack>
          )}

          <VarietyPicker
            species={speciesOptions}
            value={{ speciesId: species?.id, morphIds }}
            onChange={(next) => {
              setSpecies(next.species);
              setMorphIds(next.morphIds);
            }}
            autoFocus={!initialSpecies}
            error={errors.species}
            helperText={
              errors.species ??
              'Busca por nombre común, científico o de la variedad. Si no está, dala de alta en «Especies y morphs».'
            }
          />

          <Stack direction="row" spacing={2}>
            <TextField
              label={quantityLabel(species)}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              error={Boolean(errors.quantity)}
              helperText={errors.quantity}
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Precio de venta"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              error={Boolean(errors.price)}
              helperText={
                errors.price ??
                (existing
                  ? `Vacío = se queda en $${existing.price}`
                  : bulk
                    ? `Por ${species.sale_format === 'package' ? 'paquete' : 'cepa'}`
                    : 'Por ejemplar')
              }
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              sx={{ flex: 1 }}
            />
          </Stack>

          {existing && (
            <Alert severity="info" icon={false}>
              Ya hay {existing.stock} en venta: lo que pongas aquí se suma a ese registro.
            </Alert>
          )}

          <FormControlLabel
            control={
              <Checkbox checked={quickSale} onChange={(e) => setQuickSale(e.target.checked)} />
            }
            label="También en la venta rápida (botón para convenciones)"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        <Button variant="contained" loading={saving} onClick={submit}>
          Poner en venta
        </Button>
      </DialogActions>
    </Dialog>
  );
}
