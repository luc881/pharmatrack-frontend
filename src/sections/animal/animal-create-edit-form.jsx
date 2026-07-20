import { mutate } from 'swr';
import { z as zod } from 'zod';
import { useNavigate } from 'react-router';
import { useRef, useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';

import { handleApiError } from 'src/utils/handle-api-error';

import { endpoints } from 'src/lib/axios';
import { uploadToCloudinary } from 'src/lib/cloudinary';
import {
  createAnimal,
  updateAnimal,
  useAllGenera,
  useAllMorphs,
  useAllSpecies,
  useAnimalGroupTree,
} from 'src/actions/animal';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Field } from 'src/components/hook-form';

import { useAuthContext } from 'src/auth/hooks';

import { TaxonDialog } from './taxon-dialog';
import { SEX_OPTIONS, saleFormatLabel, flattenGroupTree } from './utils';

// ----------------------------------------------------------------------

const schema = zod.object({
  species_id: zod
    .union([zod.string(), zod.number()])
    .refine((v) => v !== '' && Number(v) > 0, { message: 'Selecciona una especie' }),
  sex: zod.enum(['male', 'female', 'unknown']),
  birth_date: zod.string().optional(),
  price: zod.number({ coerce: true }).nonnegative('El precio no puede ser negativo'),
  compare_at_price: zod.union([zod.string(), zod.number()]).optional(),
  price_cost: zod.union([zod.string(), zod.number()]).optional(),
  code: zod.string().optional(),
  morphs: zod.array(zod.number()),
  description: zod.string().optional(),
  image: zod.string().optional(),
  status: zod.enum(['available', 'reserved']).optional(),
  photos: zod.array(zod.string()),
  requires_legal_doc: zod.boolean(),
  legal_doc: zod.string().optional(),
  legal_doc_url: zod.string().optional(),
  // Unidades idénticas (solo especies en cepa/paquete)
  stock: zod.number({ coerce: true }).min(1, 'Mínimo 1').optional(),
});

// ----------------------------------------------------------------------

export function AnimalCreateEditForm({ currentAnimal }) {
  const navigate = useNavigate();
  const isEdit = !!currentAnimal;

  const { user } = useAuthContext();

  const { genera, generaMutate } = useAllGenera();
  const { species: allSpecies, speciesMutate } = useAllSpecies();
  const { groupTree } = useAnimalGroupTree();
  const groupsFlat = flattenGroupTree(groupTree);

  // Crear/editar taxonomía sin salir del formulario: {tab, current?}
  const [quickCreate, setQuickCreate] = useState(null);
  const canCreate = (resource) => user?.permissions?.includes(`${resource}.create`);
  const canUpdateSpecies = user?.permissions?.includes('species.update');

  // El género no viaja en el payload (solo species_id); es un filtro en cascada
  const [genusId, setGenusId] = useState('');

  useEffect(() => {
    if (currentAnimal?.species?.genus?.id) setGenusId(currentAnimal.species.genus.id);
  }, [currentAnimal]);

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      species_id: '',
      sex: 'unknown',
      birth_date: '',
      price: '',
      compare_at_price: '',
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
      stock: 1,
    },
    values: currentAnimal
      ? {
          species_id: currentAnimal.species_id,
          sex: currentAnimal.sex ?? 'unknown',
          birth_date: currentAnimal.birth_date ?? '',
          price: currentAnimal.price ?? '',
          compare_at_price: currentAnimal.compare_at_price ?? '',
          price_cost: currentAnimal.price_cost ?? '',
          code: currentAnimal.code ?? '',
          morphs: (currentAnimal.morphs ?? []).map((m) => m.id),
          description: currentAnimal.description ?? '',
          image: currentAnimal.image ?? '',
          status: currentAnimal.status === 'reserved' ? 'reserved' : 'available',
          photos: currentAnimal.photos ?? [],
          requires_legal_doc: !!currentAnimal.requires_legal_doc,
          legal_doc: currentAnimal.legal_doc ?? '',
          legal_doc_url: currentAnimal.legal_doc_url ?? '',
          stock: currentAnimal.stock ?? 1,
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
  const { morphs: speciesMorphs, morphsMutate } = useAllMorphs(speciesId ? Number(speciesId) : undefined);

  // Cepas/paquetes: un registro con N unidades idénticas (stock del lote gemelo)
  const selectedSpecies = allSpecies.find((s) => s.id === Number(speciesId));
  const isBulk = !!selectedSpecies && selectedSpecies.sale_format !== 'individual';

  // Al CAMBIAR de especie se limpian los morphs (pertenecen a la anterior;
  // el backend rechaza con 400 morphs de otra especie). El ref distingue la
  // primera carga (editar: los values llegan después del primer render y
  // antes borraban los morphs guardados) de un cambio real del usuario.
  const prevSpeciesRef = useRef(null);
  useEffect(() => {
    if (!speciesId) return;
    if (prevSpeciesRef.current === null) {
      prevSpeciesRef.current = speciesId;
      return;
    }
    if (prevSpeciesRef.current !== speciesId) {
      prevSpeciesRef.current = speciesId;
      if (getValues('morphs').length) setValue('morphs', []);
    }
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
      // Especies de stock (cepa/paquete): sin sexo, fecha ni papeles por ejemplar
      const legalDoc = !isBulk && data.requires_legal_doc;
      const payload = {
        species_id: Number(data.species_id),
        sex: isBulk ? 'unknown' : data.sex,
        birth_date: !isBulk && data.birth_date ? data.birth_date : null,
        price: Number(data.price),
        compare_at_price:
          data.compare_at_price !== '' && data.compare_at_price != null
            ? Number(data.compare_at_price)
            : null,
        price_cost: data.price_cost !== '' && data.price_cost != null ? Number(data.price_cost) : 0,
        morph_ids: data.morphs,
        description: data.description || null,
        image: data.image || null,
        // replace-all: siempre se manda la lista completa resultante
        photos: data.photos,
        requires_legal_doc: legalDoc,
        legal_doc: legalDoc ? data.legal_doc || null : null,
        legal_doc_url: legalDoc ? data.legal_doc_url || null : null,
        // si se omite el código, el backend genera uno "AN-XXXXXXXX"
        ...(data.code ? { code: data.code } : {}),
        // solo las cepas/paquetes manejan stock; individuales quedan en 1
        ...(isBulk ? { stock: Number(data.stock) || 1 } : {}),
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
            <Box sx={{ gap: 1, display: 'flex', alignItems: 'flex-start' }}>
              <TextField
                select
                fullWidth
                label="Género *"
                value={genusId}
                onChange={(e) => {
                  setGenusId(e.target.value);
                  setValue('species_id', '');
                }}
              >
                {genera.map((g) => (
                  <MenuItem key={g.id} value={g.id}>
                    {g.name}
                  </MenuItem>
                ))}
              </TextField>
              {canCreate('genera') && (
                <Tooltip title="Nuevo género">
                  <IconButton onClick={() => setQuickCreate({ tab: 'genera' })} sx={{ mt: 1 }}>
                    <Iconify icon="mingcute:add-line" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            <Box sx={{ gap: 1, display: 'flex', alignItems: 'flex-start' }}>
              <Field.Select
                name="species_id"
                label="Especie *"
                disabled={!genusId}
                helperText={genusId ? '' : 'Selecciona primero un género'}
              >
                {allSpecies
                  .filter((s) => s.genus?.id === Number(genusId))
                  .map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                      {s.common_name ? ` — ${s.common_name}` : ''}
                    </MenuItem>
                  ))}
              </Field.Select>
              {canCreate('species') && (
                <Tooltip title="Nueva especie">
                  <IconButton onClick={() => setQuickCreate({ tab: 'species' })} sx={{ mt: 1 }}>
                    <Iconify icon="mingcute:add-line" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            {/* El formato de la especie decide el modo del formulario:
                individual = folio único con sexo/nacimiento/papeles;
                cepa/paquete = solo cantidad de stock */}
            {selectedSpecies && (
              <Alert
                severity="info"
                variant="outlined"
                sx={{ gridColumn: { sm: 'span 2' } }}
                action={
                  canUpdateSpecies && (
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => setQuickCreate({ tab: 'species', current: selectedSpecies })}
                    >
                      Cambiar formato
                    </Button>
                  )
                }
              >
                {isBulk
                  ? `Esta especie se vende por ${saleFormatLabel(selectedSpecies)?.toLowerCase()} — se maneja solo por cantidad de stock, sin sexo, fecha ni papeles por ejemplar.`
                  : 'Esta especie se vende por ejemplar individual — cada animal lleva su folio con sexo, nacimiento y documentación.'}
              </Alert>
            )}

            <Box sx={{ gap: 1, display: 'flex', alignItems: 'flex-start' }}>
              {/* Select con checkboxes (no tags): los elegidos se listan separados por coma */}
              <Field.MultiSelect
                checkbox
                name="morphs"
                label="Morphs"
                disabled={!speciesId}
                options={speciesMorphs.map((m) => ({ value: m.id, label: m.name }))}
                helperText={speciesId ? '' : 'Selecciona primero una especie'}
                sx={{ flexGrow: 1 }}
              />
              {canCreate('morphs') && (
                <Tooltip title="Nuevo morph">
                  <span>
                    <IconButton
                      disabled={!speciesId}
                      onClick={() => setQuickCreate({ tab: 'morphs' })}
                      sx={{ mt: 1 }}
                    >
                      <Iconify icon="mingcute:add-line" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Box>

            {!isBulk && (
              <Field.Select name="sex" label="Sexo">
                {SEX_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Field.Select>
            )}

            {isBulk && (
              <Field.Text
                name="stock"
                label="Cantidad disponible"
                type="number"
                helperText="Unidades idénticas de esta cepa/paquete; se descuentan al vender"
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: 1 } }}
              />
            )}

            {!isBulk && (
              <Field.Text
                name="birth_date"
                label="Fecha de nacimiento"
                type="date"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}

            <Field.Text
              name="price"
              label="Precio de venta *"
              type="number"
              helperText={
                isBulk
                  ? `Precio por ${selectedSpecies?.sale_format === 'package' ? `paquete de ${selectedSpecies.package_size}` : 'cepa'}`
                  : ''
              }
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
              name="compare_at_price"
              label="Precio anterior (oferta)"
              type="number"
              helperText="Se muestra tachado en la tienda; vacío = sin oferta"
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
            {!isBulk && (
              <Field.Switch
                name="requires_legal_doc"
                label="Requiere documentación legal (SEMARNAT)"
                sx={{ gridColumn: { sm: 'span 2' } }}
              />
            )}

            {!isBulk && requiresLegalDoc && (
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

      {/* Crear género/especie/morph al vuelo; lo creado queda seleccionado */}
      {quickCreate && (
        <TaxonDialog
          tab={quickCreate.tab}
          singular={{ genera: 'género', species: 'especie', morphs: 'morph' }[quickCreate.tab]}
          current={quickCreate.current ?? null}
          initial={{ genus_id: genusId || '', species_id: speciesId || '' }}
          genera={genera}
          allSpecies={allSpecies}
          groupsFlat={groupsFlat}
          onClose={() => setQuickCreate(null)}
          onSaved={async (saved) => {
            if (quickCreate.tab === 'genera') {
              await generaMutate();
              setGenusId(saved.id);
              setValue('species_id', '');
            } else if (quickCreate.tab === 'species') {
              await speciesMutate();
              // editar (p. ej. cambiar el formato de venta) conserva la selección
              if (!quickCreate.current) {
                setGenusId(saved.genus_id);
                setValue('species_id', saved.id, { shouldValidate: true });
              }
            } else {
              await morphsMutate();
              setValue('morphs', [...getValues('morphs'), saved.id], { shouldDirty: true });
            }
          }}
        />
      )}
    </FormProvider>
  );
}
