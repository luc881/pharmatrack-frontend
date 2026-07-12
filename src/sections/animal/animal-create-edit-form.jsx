import { mutate } from 'swr';
import { z as zod } from 'zod';
import { useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';

import { handleApiError } from 'src/utils/handle-api-error';

import { endpoints } from 'src/lib/axios';
import { uploadToCloudinary } from 'src/lib/cloudinary';
import { useAllMorphs, createAnimal, updateAnimal, useAllSpecies } from 'src/actions/animal';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Field } from 'src/components/hook-form';

import { SEX_OPTIONS, speciesLabel } from './utils';

// ----------------------------------------------------------------------

const schema = zod.object({
  species_id: zod
    .union([zod.string(), zod.number()])
    .refine((v) => v !== '' && Number(v) > 0, { message: 'Selecciona una especie' }),
  sex: zod.enum(['male', 'female', 'unknown']),
  birth_date: zod.string().optional(),
  price: zod.number({ coerce: true }).nonnegative('El precio no puede ser negativo'),
  price_cost: zod.union([zod.string(), zod.number()]).optional(),
  code: zod.string().optional(),
  morphs: zod.array(zod.any()),
  description: zod.string().optional(),
  image: zod.string().optional(),
  status: zod.enum(['available', 'reserved']).optional(),
  photos: zod.array(zod.string()),
  requires_legal_doc: zod.boolean(),
  legal_doc: zod.string().optional(),
  legal_doc_url: zod.string().optional(),
});

// ----------------------------------------------------------------------

export function AnimalCreateEditForm({ currentAnimal }) {
  const navigate = useNavigate();
  const isEdit = !!currentAnimal;

  const { species: allSpecies } = useAllSpecies();

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      species_id: '',
      sex: 'unknown',
      birth_date: '',
      price: '',
      price_cost: '',
      code: '',
      morphs: [],
      description: '',
      image: '',
      status: 'available',
      photos: [],
      requires_legal_doc: false,
      legal_doc: '',
      legal_doc_url: '',
    },
    values: currentAnimal
      ? {
          species_id: currentAnimal.species_id,
          sex: currentAnimal.sex ?? 'unknown',
          birth_date: currentAnimal.birth_date ?? '',
          price: currentAnimal.price ?? '',
          price_cost: currentAnimal.price_cost ?? '',
          code: currentAnimal.code ?? '',
          morphs: currentAnimal.morphs ?? [],
          description: currentAnimal.description ?? '',
          image: currentAnimal.image ?? '',
          status: currentAnimal.status === 'reserved' ? 'reserved' : 'available',
          photos: currentAnimal.photos ?? [],
          requires_legal_doc: !!currentAnimal.requires_legal_doc,
          legal_doc: currentAnimal.legal_doc ?? '',
          legal_doc_url: currentAnimal.legal_doc_url ?? '',
        }
      : undefined,
  });

  const {
    watch,
    setError,
    setValue,
    getValues,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const speciesId = watch('species_id');
  const { morphs: speciesMorphs } = useAllMorphs(speciesId ? Number(speciesId) : undefined);

  // Al cambiar de especie, quitar los morphs que no le pertenecen
  // (el backend rechaza con 400 morphs de otra especie)
  useEffect(() => {
    const current = getValues('morphs');
    const kept = current.filter((m) => m.species_id === Number(speciesId));
    if (kept.length !== current.length) setValue('morphs', kept);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speciesId]);

  const isSold = currentAnimal?.status === 'sold';

  const photos = watch('photos');
  const requiresLegalDoc = watch('requires_legal_doc');
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');

  const addPhotoFiles = async (files) => {
    setPhotosLoading(true);
    try {
      const urls = await Promise.all([...files].map((f) => uploadToCloudinary(f)));
      setValue('photos', [...getValues('photos'), ...urls], { shouldDirty: true });
    } catch {
      toast.error('Error al subir las fotos');
    } finally {
      setPhotosLoading(false);
    }
  };

  const removePhoto = (index) =>
    setValue('photos', getValues('photos').filter((_, i) => i !== index), { shouldDirty: true });

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = {
        species_id: Number(data.species_id),
        sex: data.sex,
        birth_date: data.birth_date || null,
        price: Number(data.price),
        price_cost: data.price_cost !== '' && data.price_cost != null ? Number(data.price_cost) : 0,
        morph_ids: data.morphs.map((m) => m.id),
        description: data.description || null,
        image: data.image || null,
        // replace-all: siempre se manda la lista completa resultante
        photos: data.photos,
        requires_legal_doc: data.requires_legal_doc,
        legal_doc: data.requires_legal_doc ? data.legal_doc || null : null,
        legal_doc_url: data.requires_legal_doc ? data.legal_doc_url || null : null,
        // si se omite el código, el backend genera uno "AN-XXXXXXXX"
        ...(data.code ? { code: data.code } : {}),
        // "sold" solo lo asigna el flujo de venta — nunca se manda desde aquí
        ...(isEdit && !isSold ? { status: data.status } : {}),
      };

      if (isEdit) {
        await updateAnimal(currentAnimal.id, payload);
      } else {
        await createAnimal(payload);
      }

      toast.success(isEdit ? 'Animal actualizado' : 'Animal registrado');
      mutate((key) => Array.isArray(key) && key[0] === endpoints.animal.list);
      navigate(paths.dashboard.animal.root);
    } catch (error) {
      if (!handleApiError(error, setError)) {
        toast.error(error.message || 'Error al guardar el animal');
      }
    }
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Información del animal
          </Typography>

          <Box sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Field.Select name="species_id" label="Especie *">
              {allSpecies.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {speciesLabel(s)}
                </MenuItem>
              ))}
            </Field.Select>

            <Field.Autocomplete
              name="morphs"
              label="Morphs"
              multiple
              disableCloseOnSelect
              disabled={!speciesId}
              options={speciesMorphs}
              getOptionLabel={(o) => o?.name ?? ''}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
              slotProps={{
                textField: { helperText: speciesId ? '' : 'Selecciona primero una especie' },
              }}
            />

            <Field.Select name="sex" label="Sexo">
              {SEX_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Field.Select>

            <Field.Text
              name="birth_date"
              label="Fecha de nacimiento"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <Field.Text
              name="price"
              label="Precio de venta *"
              type="number"
              slotProps={{
                inputLabel: { shrink: true },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box sx={{ typography: 'subtitle2', color: 'text.disabled' }}>$</Box>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Field.Text
              name="price_cost"
              label="Costo"
              type="number"
              slotProps={{
                inputLabel: { shrink: true },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box sx={{ typography: 'subtitle2', color: 'text.disabled' }}>$</Box>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Field.Text
              name="code"
              label="Código"
              helperText="Si se deja vacío se genera automáticamente"
              slotProps={{ inputLabel: { shrink: true } }}
            />

            {isEdit && !isSold && (
              <Field.Select name="status" label="Estado">
                <MenuItem value="available">Disponible</MenuItem>
                <MenuItem value="reserved">Reservado</MenuItem>
              </Field.Select>
            )}

            <Field.Text
              name="image"
              label="Imagen (URL)"
              sx={{ gridColumn: { sm: 'span 2' } }}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <Field.Text
              name="description"
              label="Descripción"
              multiline
              rows={3}
              sx={{ gridColumn: { sm: 'span 2' } }}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            {/* Documentación legal (SEMARNAT) — opcional por animal */}
            <Field.Switch
              name="requires_legal_doc"
              label="Requiere documentación legal (SEMARNAT)"
              sx={{ gridColumn: { sm: 'span 2' } }}
            />

            {requiresLegalDoc && (
              <>
                <Field.Text
                  name="legal_doc"
                  label="Folio del documento"
                  helperText="Folio/referencia de procedencia legal"
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <Field.Text
                  name="legal_doc_url"
                  label="URL del documento"
                  helperText="Enlace al documento escaneado"
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </>
            )}

            {/* Fotos — replace-all: la lista que se ve es la que se guarda */}
            <Box sx={{ gridColumn: { sm: 'span 2' } }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Fotos
              </Typography>

              {photos.length > 0 && (
                <Box sx={{ mb: 2, gap: 1, display: 'flex', flexWrap: 'wrap' }}>
                  {photos.map((url, index) => (
                    <Box key={`${url}-${index}`} sx={{ position: 'relative' }}>
                      <Box
                        component="img"
                        src={url}
                        alt={`Foto ${index + 1}`}
                        sx={{ width: 96, height: 96, borderRadius: 1, objectFit: 'cover' }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => removePhoto(index)}
                        sx={{
                          top: 2,
                          right: 2,
                          position: 'absolute',
                          bgcolor: 'background.paper',
                          '&:hover': { bgcolor: 'background.paper' },
                        }}
                      >
                        <Iconify icon="mingcute:close-line" width={14} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}

              <Box sx={{ gap: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
                <Button
                  component="label"
                  variant="outlined"
                  loading={photosLoading}
                  startIcon={<Iconify icon="solar:camera-add-bold" />}
                >
                  Subir fotos
                  <input
                    hidden
                    multiple
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.length) addPhotoFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </Button>

                <TextField
                  size="small"
                  label="o pega una URL"
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  sx={{ minWidth: 240 }}
                />
                <Button
                  disabled={!photoUrlInput.trim()}
                  onClick={() => {
                    setValue('photos', [...getValues('photos'), photoUrlInput.trim()], { shouldDirty: true });
                    setPhotoUrlInput('');
                  }}
                >
                  Agregar
                </Button>
              </Box>

              <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
                Si no se indica una imagen principal, la primera foto se usa como principal (también en el POS).
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" loading={isSubmitting}>
              {isEdit ? 'Guardar cambios' : 'Registrar animal'}
            </Button>
          </Box>
        </Card>
      </form>
    </FormProvider>
  );
}
