import { useState } from 'react';

import Box from '@mui/material/Box';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

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

import { speciesLabel } from './utils';

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
    show_public: base?.show_public ?? true,
    feature_home: base?.feature_home ?? false,
    group_id: base?.group_id ?? base?.group?.id ?? '',
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

  // Un subgrupo siempre puede destacarse; un raíz sólo si está visible
  const canFeature = !!form.parent_id || form.show_public;

  // Un grupo no puede colgar de sí mismo ni de sus descendientes
  const parentOptions = groupsFlat.filter(
    (g) => !current || (g.id !== current.id && !g.ancestors.includes(current.id))
  );

  const missingParent =
    (tab === 'species' && !form.genus_id) || (tab === 'morphs' && !form.species_id);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        groups: {
          name: form.name,
          parent_id: form.parent_id ? Number(form.parent_id) : null,
          show_public: form.show_public,
          // un raíz oculto no puede destacarse; un subgrupo sí
          feature_home: canFeature && form.feature_home,
        },
        genera: { name: form.name, group_id: form.group_id ? Number(form.group_id) : null },
        species: {
          genus_id: Number(form.genus_id),
          name: form.name,
          common_name: form.common_name || null,
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
          <Autocomplete
            options={parentOptions}
            value={parentOptions.find((g) => g.id === Number(form.parent_id)) ?? null}
            onChange={(_, option) => setForm((f) => ({ ...f, parent_id: option?.id ?? '' }))}
            getOptionLabel={(option) => option?.name ?? ''}
            isOptionEqualToValue={(option, value) => option?.id === value?.id}
            renderOption={({ key, ...props }, option) => (
              <li key={key} {...props} style={{ ...props.style, paddingLeft: 16 + option.depth * 16 }}>
                {option.depth > 0 && '└ '}
                {option.name}
              </li>
            )}
            renderInput={(params) => (
              <TextField {...params} label="Grupo padre" placeholder="— Raíz —" sx={{ mt: 1 }} />
            )}
          />
        )}

        {tab === 'groups' && (
          <Box>
            {/* Visibilidad: solo a nivel raíz (oculta todo el subárbol) */}
            {!form.parent_id && (
              <>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.show_public}
                      onChange={(e) => setForm((f) => ({ ...f, show_public: e.target.checked }))}
                    />
                  }
                  label="Visible en el sitio público"
                />
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', ml: 1.5, mb: 1 }}>
                  Apagado: no aparece en el menú, en explorar por grupo ni en resultados del sitio
                  (incluye sus subgrupos).
                </Typography>
              </>
            )}

            {/* Destacar: cualquier grupo, raíz o subgrupo */}
            <FormControlLabel
              disabled={!canFeature}
              control={
                <Switch
                  checked={canFeature && form.feature_home}
                  onChange={(e) => setForm((f) => ({ ...f, feature_home: e.target.checked }))}
                />
              }
              label="Destacar en la página principal"
            />
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', ml: 1.5 }}>
              Muestra un mini-catálogo con las especies de este grupo (o sus subgrupos) en el
              inicio del sitio.
            </Typography>
          </Box>
        )}

        {tab === 'species' && (
          <Autocomplete
            options={genera}
            value={genera.find((g) => g.id === Number(form.genus_id)) ?? null}
            onChange={(_, option) => setForm((f) => ({ ...f, genus_id: option?.id ?? '' }))}
            getOptionLabel={(option) => option?.name ?? ''}
            isOptionEqualToValue={(option, value) => option?.id === value?.id}
            renderInput={(params) => <TextField {...params} label="Género *" sx={{ mt: 1 }} />}
          />
        )}

        {tab === 'morphs' && (
          <Autocomplete
            options={allSpecies}
            value={allSpecies.find((sp) => sp.id === Number(form.species_id)) ?? null}
            onChange={(_, option) => setForm((f) => ({ ...f, species_id: option?.id ?? '' }))}
            getOptionLabel={(option) => (option ? speciesLabel(option) : '')}
            isOptionEqualToValue={(option, value) => option?.id === value?.id}
            renderInput={(params) => <TextField {...params} label="Especie *" sx={{ mt: 1 }} />}
          />
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
          <Autocomplete
            options={groupsFlat}
            value={groupsFlat.find((g) => g.id === Number(form.group_id)) ?? null}
            onChange={(_, option) => setForm((f) => ({ ...f, group_id: option?.id ?? '' }))}
            getOptionLabel={(option) => option?.name ?? ''}
            isOptionEqualToValue={(option, value) => option?.id === value?.id}
            renderOption={({ key, ...props }, option) => (
              <li key={key} {...props} style={{ ...props.style, paddingLeft: 16 + option.depth * 16 }}>
                {option.depth > 0 && '└ '}
                {option.name}
              </li>
            )}
            renderInput={(params) => (
              <TextField {...params} label="Grupo" placeholder="Sin grupo" />
            )}
          />
        )}

        {tab === 'species' && (
          <>
            <TextField label="Nombre común" value={form.common_name} onChange={set('common_name')} />

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
