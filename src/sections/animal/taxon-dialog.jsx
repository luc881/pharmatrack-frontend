import { mutate } from 'swr';
import { useState } from 'react';

import Box from '@mui/material/Box';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';

import { handleApiError } from 'src/utils/handle-api-error';

import { endpoints } from 'src/lib/axios';
import { uploadToCloudinary } from 'src/lib/cloudinary';
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
import { Iconify } from 'src/components/iconify';

import { speciesLabel } from './utils';

// ----------------------------------------------------------------------

// El nombre del morph se guarda entre comillas simples ('Red'). Se limpian
// las comillas que ya trae (al re-editar) para no acumularlas: ''Red''.
function quoteMorph(name) {
  const bare = name.trim().replace(/^'+|'+$/g, '');
  return `'${bare}'`;
}

export const TAXON_ACTIONS = {
  groups: { create: createAnimalGroup, update: updateAnimalGroup, delete: deleteAnimalGroup },
  genera: { create: createGenus, update: updateGenus, delete: deleteGenus },
  species: { create: createSpecies, update: updateSpecies, delete: deleteSpecies },
  morphs: { create: createMorph, update: updateMorph, delete: deleteMorph },
};

// ----------------------------------------------------------------------

const filter = createFilterOptions();

// Revalida géneros y grupos en cualquier vista abierta tras crearlos aquí
const refreshTaxa = () =>
  mutate((key) => {
    const url = Array.isArray(key) ? key[0] : key;
    return (
      typeof url === 'string' &&
      (url.startsWith(endpoints.genus.list) || url.startsWith(endpoints.animalGroup.list))
    );
  });

const groupOption = ({ key, ...props }, option) => (
  <li key={key} {...props} style={{ ...props.style, paddingLeft: 16 + (option.depth ?? 0) * 16 }}>
    {option.depth > 0 && '└ '}
    {option.name}
  </li>
);

// Autocomplete que además ofrece «Crear "lo escrito"» si no existe. Lo nuevo
// solo se crea al guardar el diálogo (newName), no al elegirlo.
function CreatableField({ options, value, newName, onPick, onCreate, label, noun, helperText, renderOption }) {
  return (
    <Autocomplete
      options={options}
      value={newName ? { __new: newName } : value}
      onChange={(_, option) => (option?.__create ? onCreate(option.__create) : onPick(option))}
      filterOptions={(opts, params) => {
        const out = filter(opts, params);
        const typed = params.inputValue.trim();
        if (typed && !opts.some((o) => o.name.toLowerCase() === typed.toLowerCase())) {
          out.push({ __create: typed });
        }
        return out;
      }}
      getOptionLabel={(o) => (o?.__new ? `${o.__new} (nuevo)` : (o?.name ?? ''))}
      isOptionEqualToValue={(o, v) => (o.__new ? o.__new === v.__new : o?.id === v?.id)}
      renderOption={({ key, ...props }, option) => {
        if (option.__create) {
          return (
            <li key="__create" {...props}>
              <Iconify icon="mingcute:add-line" width={16} sx={{ mr: 1, color: 'primary.main' }} />
              {`Crear ${noun} «${option.__create}»`}
            </li>
          );
        }
        if (renderOption) return renderOption({ key, ...props }, option);
        return (
          <li key={key} {...props}>
            {option.name}
          </li>
        );
      }}
      renderInput={(params) => <TextField {...params} label={label} helperText={helperText} />}
    />
  );
}

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
    image: base?.image ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [nameError, setNameError] = useState('');
  // Género/grupo escritos que todavía no existen: se crean al guardar
  const [newGenus, setNewGenus] = useState(null);
  const [newGroup, setNewGroup] = useState(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Foto del taxón: tarjeta del catálogo cuando la especie no tiene ejemplares
  // (la mayoría hoy). PUT parcial: el campo viaja siempre en el payload, pero
  // solo cambia lo que este diálogo edita.
  const handlePickImage = async (file) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadToCloudinary(file);
      setForm((f) => ({ ...f, image: url }));
    } catch (error) {
      toast.error(error.message || 'Error al subir la imagen');
    } finally {
      setUploadingImage(false);
    }
  };

  // Un subgrupo siempre puede destacarse; un raíz sólo si está visible
  const canFeature = !!form.parent_id || form.show_public;

  // Un grupo no puede colgar de sí mismo ni de sus descendientes
  const parentOptions = groupsFlat.filter(
    (g) => !current || (g.id !== current.id && !g.ancestors.includes(current.id))
  );

  const missingParent =
    (tab === 'species' && !form.genus_id && !newGenus) || (tab === 'morphs' && !form.species_id);

  const selectedGenus = genera.find((g) => g.id === Number(form.genus_id));
  const genusName = newGenus ?? selectedGenus?.name ?? '';

  // "Phyllium gardabagusi" en el campo de especie → solo "gardabagusi"
  const speciesName = () => {
    const name = form.name.trim();
    const prefix = `${genusName.toLowerCase()} `;
    return genusName && name.toLowerCase().startsWith(prefix) ? name.slice(prefix.length).trim() : name;
  };

  // Crea primero lo que falte (grupo → género). Ya creados pasan a ser
  // opciones normales: si después falla la especie, reintentar no duplica.
  const ensureGroup = async () => {
    if (!newGroup) return form.group_id ? Number(form.group_id) : null;
    const group = await createAnimalGroup({ name: newGroup, parent_id: null, show_public: true, feature_home: false });
    setNewGroup(null);
    setForm((f) => ({ ...f, group_id: group.id }));
    await refreshTaxa();
    return group.id;
  };

  const ensureGenus = async () => {
    if (!newGenus) return Number(form.genus_id);
    const genus = await createGenus({ name: newGenus, group_id: await ensureGroup() });
    setNewGenus(null);
    setForm((f) => ({ ...f, genus_id: genus.id }));
    await refreshTaxa();
    return genus.id;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const genusId = tab === 'species' ? await ensureGenus() : null;
      const groupId = tab === 'genera' ? await ensureGroup() : null;
      const payload = {
        groups: {
          name: form.name,
          parent_id: form.parent_id ? Number(form.parent_id) : null,
          show_public: form.show_public,
          // un raíz oculto no puede destacarse; un subgrupo sí
          feature_home: canFeature && form.feature_home,
        },
        genera: { name: form.name, group_id: groupId },
        species: {
          genus_id: genusId,
          name: speciesName(),
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
          image: form.image || null,
        },
        morphs: {
          species_id: Number(form.species_id),
          name: quoteMorph(form.name),
          description: form.description || null,
          image: form.image || null,
        },
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
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <CreatableField
              options={genera}
              value={selectedGenus ?? null}
              newName={newGenus}
              noun="género"
              label="Género *"
              helperText={
                newGenus
                  ? 'Se crea junto con la especie.'
                  : selectedGenus
                    ? `Grupo: ${selectedGenus.group?.name ?? 'sin grupo'}`
                    : 'Escribe para buscarlo. Si no existe, elige «Crear género».'
              }
              onPick={(g) => {
                setNewGenus(null);
                setForm((f) => ({ ...f, genus_id: g?.id ?? '' }));
              }}
              onCreate={(name) => {
                setNewGenus(name);
                setForm((f) => ({ ...f, genus_id: '' }));
              }}
            />
            {/* Género nuevo: aquí mismo se elige (o crea) su grupo */}
            {newGenus && (
              <CreatableField
                options={groupsFlat}
                value={groupsFlat.find((g) => g.id === Number(form.group_id)) ?? null}
                newName={newGroup}
                noun="grupo"
                label={`Grupo de ${newGenus}`}
                helperText="Ej. Arácnidos, Isópodos. Opcional, pero ordena el catálogo."
                renderOption={groupOption}
                onPick={(g) => {
                  setNewGroup(null);
                  setForm((f) => ({ ...f, group_id: g?.id ?? '' }));
                }}
                onCreate={(name) => {
                  setNewGroup(name);
                  setForm((f) => ({ ...f, group_id: '' }));
                }}
              />
            )}
          </Box>
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

        {(tab === 'species' || tab === 'morphs') && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 72,
                height: 72,
                flexShrink: 0,
                borderRadius: 1.5,
                overflow: 'hidden',
                bgcolor: 'background.neutral',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {form.image ? (
                <Box component="img" src={form.image} alt="" sx={{ width: 1, height: 1, objectFit: 'cover' }} />
              ) : (
                <Iconify icon="solar:gallery-bold" width={28} sx={{ color: 'text.disabled' }} />
              )}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                component="label"
                variant="outlined"
                size="small"
                disabled={uploadingImage}
                startIcon={<Iconify icon={uploadingImage ? 'eos-icons:loading' : 'solar:upload-bold'} width={16} />}
              >
                {uploadingImage ? 'Subiendo…' : form.image ? 'Reemplazar imagen' : 'Subir imagen'}
                {/* Input anidado y SIN htmlFor: mismo patrón que site-media-view.jsx,
                    evita que el selector se dispare dos veces en algunos navegadores. */}
                <Box
                  component="input"
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    handlePickImage(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </Button>
              {form.image && (
                <Button color="error" size="small" onClick={() => setForm((f) => ({ ...f, image: null }))}>
                  Quitar imagen
                </Button>
              )}
            </Box>
          </Box>
        )}

        <TextField
          label={tab === 'species' ? 'Especie (nombre científico) *' : 'Nombre *'}
          placeholder={tab === 'species' ? 'Ej. gardabagusi' : undefined}
          value={form.name}
          onChange={(e) => {
            setNameError('');
            set('name')(e);
          }}
          error={!!nameError}
          helperText={
            nameError ||
            (tab === 'species' && form.name.trim()
              ? `Quedará como: ${[genusName, speciesName()].filter(Boolean).join(' ')}`
              : undefined)
          }
          sx={{ mt: tab === 'genera' ? 1 : 0 }}
        />

        {tab === 'morphs' && (
          <TextField
            label="Descripción del morph"
            multiline
            rows={5}
            value={form.description}
            onChange={set('description')}
            helperText="Texto propio de este morph para su página del catálogo (apariencia, marketing…). Los cuidados se heredan de la especie. Una línea en blanco separa párrafos."
          />
        )}

        {tab === 'genera' && (
          <CreatableField
            options={groupsFlat}
            value={groupsFlat.find((g) => g.id === Number(form.group_id)) ?? null}
            newName={newGroup}
            noun="grupo"
            label="Grupo"
            helperText={newGroup ? 'Se crea junto con el género.' : 'Si no existe, escríbelo y elige «Crear grupo».'}
            renderOption={groupOption}
            onPick={(g) => {
              setNewGroup(null);
              setForm((f) => ({ ...f, group_id: g?.id ?? '' }));
            }}
            onCreate={(name) => {
              setNewGroup(name);
              setForm((f) => ({ ...f, group_id: '' }));
            }}
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

      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          loading={saving}
          disabled={!form.name.trim() || missingParent || uploadingImage}
          onClick={handleSave}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
