import { useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { handleApiError } from 'src/utils/handle-api-error';

import {
  createGenus,
  updateGenus,
  deleteGenus,
  createMorph,
  updateMorph,
  deleteMorph,
  createSpecies,
  updateSpecies,
  deleteSpecies,
  createAnimalGroup,
  updateAnimalGroup,
  deleteAnimalGroup,
} from 'src/actions/animal';

import { toast } from 'src/components/snackbar';

import { speciesLabel, SALE_FORMAT_OPTIONS } from './utils';

// ----------------------------------------------------------------------

export const TAXON_ACTIONS = {
  groups: { create: createAnimalGroup, update: updateAnimalGroup, delete: deleteAnimalGroup },
  genera: { create: createGenus, update: updateGenus, delete: deleteGenus },
  species: { create: createSpecies, update: updateSpecies, delete: deleteSpecies },
  morphs: { create: createMorph, update: updateMorph, delete: deleteMorph },
};

// ----------------------------------------------------------------------

// Diálogo de crear/editar cualquier nivel de la taxonomía. `current` = editar;
// `initial` prellena campos al crear (p. ej. el género elegido en el form de
// animal). onSaved recibe la entidad guardada para poder auto-seleccionarla.
export function TaxonDialog({ tab, singular, current, initial, genera, allSpecies, groupsFlat, onClose, onSaved }) {
  const isEdit = !!current;
  const base = current ?? initial;

  const [form, setForm] = useState({
    name: base?.name ?? '',
    common_name: base?.common_name ?? '',
    description: base?.description ?? '',
    genus_id: base?.genus_id ?? base?.genus?.id ?? '',
    species_id: base?.species_id ?? '',
    parent_id: base?.parent_id ?? '',
    group_id: base?.group_id ?? base?.group?.id ?? '',
    sale_format: base?.sale_format ?? 'individual',
    package_size: base?.package_size ?? '',
    origin: base?.origin ?? '',
    temperature: base?.temperature ?? '',
    humidity: base?.humidity ?? '',
    adult_size: base?.adult_size ?? '',
    difficulty: base?.difficulty ?? '',
    rarity: base?.rarity ?? '',
    habitat: base?.habitat ?? '',
    diet: base?.diet ?? '',
    notes: base?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Un grupo no puede colgar de sí mismo ni de sus descendientes
  const parentOptions = groupsFlat.filter(
    (g) => !current || (g.id !== current.id && !g.ancestors.includes(current.id))
  );

  const missingParent =
    (tab === 'species' && !form.genus_id) ||
    (tab === 'morphs' && !form.species_id) ||
    (tab === 'species' && form.sale_format === 'package' && !(Number(form.package_size) >= 2));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        groups: { name: form.name, parent_id: form.parent_id ? Number(form.parent_id) : null },
        genera: { name: form.name, group_id: form.group_id ? Number(form.group_id) : null },
        species: {
          genus_id: Number(form.genus_id),
          name: form.name,
          common_name: form.common_name || null,
          sale_format: form.sale_format,
          package_size: form.sale_format === 'package' ? Number(form.package_size) : null,
          // ficha de cuidados que muestra el sitio público
          description: form.description || null,
          origin: form.origin || null,
          temperature: form.temperature || null,
          humidity: form.humidity || null,
          adult_size: form.adult_size || null,
          difficulty: form.difficulty || null,
          rarity: form.rarity || null,
          habitat: form.habitat || null,
          diet: form.diet || null,
          notes: form.notes || null,
        },
        morphs: { species_id: Number(form.species_id), name: form.name, description: form.description || null },
      }[tab];

      const saved = isEdit
        ? await TAXON_ACTIONS[tab].update(current.id, payload)
        : await TAXON_ACTIONS[tab].create(payload);

      toast.success(isEdit ? 'Guardado correctamente' : 'Creado correctamente');
      await onSaved(saved);
      onClose();
    } catch (error) {
      // los duplicados van como error inline en el campo Nombre
      if (!handleApiError(error, (_field, { message }) => setNameError(message))) {
        toast.error(error.message || 'Error al guardar');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open fullWidth maxWidth={tab === 'species' ? 'sm' : 'xs'} onClose={onClose}>
      <DialogTitle>{`${isEdit ? 'Editar' : 'Nuevo'} ${singular}`}</DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {tab === 'groups' && (
          <TextField select label="Grupo padre" value={form.parent_id} onChange={set('parent_id')} sx={{ mt: 1 }}>
            <MenuItem value="">— Raíz —</MenuItem>
            {parentOptions.map((g) => (
              <MenuItem key={g.id} value={g.id} sx={{ pl: 2 + g.depth * 2 }}>
                {g.name}
              </MenuItem>
            ))}
          </TextField>
        )}

        {tab === 'species' && (
          <TextField select label="Género *" value={form.genus_id} onChange={set('genus_id')} sx={{ mt: 1 }}>
            {genera.map((g) => (
              <MenuItem key={g.id} value={g.id}>
                {g.name}
              </MenuItem>
            ))}
          </TextField>
        )}

        {tab === 'morphs' && (
          <TextField select label="Especie *" value={form.species_id} onChange={set('species_id')} sx={{ mt: 1 }}>
            {allSpecies.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {speciesLabel(s)}
              </MenuItem>
            ))}
          </TextField>
        )}

        <TextField
          label={tab === 'species' ? 'Nombre científico *' : 'Nombre *'}
          value={form.name}
          onChange={(e) => {
            setNameError('');
            set('name')(e);
          }}
          error={!!nameError}
          helperText={nameError}
          sx={{ mt: tab === 'genera' ? 1 : 0 }}
        />

        {tab === 'genera' && (
          <TextField select label="Grupo" value={form.group_id} onChange={set('group_id')}>
            <MenuItem value="">Sin grupo</MenuItem>
            {groupsFlat.map((g) => (
              <MenuItem key={g.id} value={g.id} sx={{ pl: 2 + g.depth * 2 }}>
                {g.name}
              </MenuItem>
            ))}
          </TextField>
        )}

        {tab === 'species' && (
          <>
            <TextField label="Nombre común" value={form.common_name} onChange={set('common_name')} />
            <TextField select label="Formato de venta" value={form.sale_format} onChange={set('sale_format')}>
              {SALE_FORMAT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            {form.sale_format === 'package' && (
              <TextField
                type="number"
                label="Ejemplares por paquete *"
                value={form.package_size}
                onChange={set('package_size')}
                slotProps={{ htmlInput: { min: 2 } }}
              />
            )}

            <Divider sx={{ borderStyle: 'dashed' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Ficha para el sitio público
              </Typography>
            </Divider>

            <TextField
              label="Descripción"
              multiline
              rows={4}
              value={form.description}
              onChange={set('description')}
              helperText="Una línea en blanco separa párrafos"
            />

            <Box sx={{ gap: 2, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <TextField label="Origen" placeholder="México (cría en cautiverio)" value={form.origin} onChange={set('origin')} />
              <TextField label="Temperatura" placeholder="24-28 °C" value={form.temperature} onChange={set('temperature')} />
              <TextField label="Humedad" placeholder="60-70 %" value={form.humidity} onChange={set('humidity')} />
              <TextField label="Tamaño adulto" placeholder="14 cm" value={form.adult_size} onChange={set('adult_size')} />
              <TextField label="Dificultad" placeholder="Principiante" value={form.difficulty} onChange={set('difficulty')} />
              <TextField label="Rareza" placeholder="Común" value={form.rarity} onChange={set('rarity')} />
            </Box>

            <TextField
              label="Hábitat y comportamiento"
              multiline
              rows={3}
              value={form.habitat}
              onChange={set('habitat')}
              helperText="Una línea en blanco separa párrafos"
            />
            <TextField
              label="Alimentación"
              multiline
              rows={3}
              value={form.diet}
              onChange={set('diet')}
            />
            <TextField
              label="Notas de esta especie"
              multiline
              rows={3}
              value={form.notes}
              onChange={set('notes')}
            />
          </>
        )}

        {tab === 'morphs' && (
          <TextField label="Descripción" multiline rows={2} value={form.description} onChange={set('description')} />
        )}
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="contained" loading={saving} disabled={!form.name.trim() || missingParent} onClick={handleSave}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
