import { mutate } from 'swr';
import { z as zod } from 'zod';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller, FormProvider, useFieldArray, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { endpoints } from 'src/lib/axios';
import { useAllSpecies } from 'src/actions/animal';
import { uploadToCloudinary } from 'src/lib/cloudinary';
import { createCareSheet, updateCareSheet } from 'src/actions/care-sheets';

import { toast } from 'src/components/snackbar';
import { Field, FormLeaveGuard } from 'src/components/hook-form';

import { speciesLabel } from 'src/sections/animal/utils';

// ----------------------------------------------------------------------

const max = (n) => zod.string().trim().max(n, `Máximo ${n} caracteres`);
const isHttps = (v) => /^https:\/\/\S+$/.test(v);
const isUrl = (v) => /^https?:\/\/\S+$/.test(v);

const makeSchema = (isEdit) =>
  zod
    .object({
      species_id: zod.number({ error: 'Elige la especie' }),
      slug: isEdit
        ? zod.string().trim().min(1, 'Al editar el slug es obligatorio')
        : zod.string().trim(),
      published: zod.boolean(),
      authority: max(200),
      origin: max(150),
      difficulty: max(50),
      summary: max(600).min(1, 'El resumen es obligatorio'),
      // filas a medias: la API las rechazaría; se avisa en la fila
      taxonomy: zod.array(
        zod
          .object({ rank: max(60), name: max(200), italic: zod.boolean() })
          .refine((r) => !r.name || r.rank, { message: 'Falta el rango', path: ['rank'] })
      ),
      facts: zod.array(
        zod
          .object({ label: max(60), value: max(120) })
          .refine((f) => !f.label || f.value, { message: 'Falta el valor', path: ['value'] })
          .refine((f) => !f.value || f.label, { message: 'Falta la etiqueta', path: ['label'] })
      ),
      basics: zod.array(zod.object({ text: zod.string().trim() })),
      references: zod.array(
        zod.object({
          text: zod.string().trim(),
          url: zod
            .string()
            .trim()
            .refine((v) => !v || isUrl(v), 'Debe empezar con https://'),
        })
      ),
      body: zod.string(),
      // ponytail: las fotos solo entran por subida o por «+ Agregar URL», que ya valida https
      photos: zod.array(
        zod.object({ src: zod.string(), alt: max(200).min(1, 'Describe qué muestra la foto') })
      ),
      video_src: zod
        .string()
        .trim()
        .refine((v) => !v || isHttps(v), 'Debe empezar con https://'),
      video_alt: max(200),
    })
    .refine((d) => !d.video_src || d.video_alt, {
      message: 'Describe qué muestra el video',
      path: ['video_alt'],
    });

const NEW_TAXONOMY = ['Orden', 'Familia', 'Género', 'Especie'].map((rank) => ({
  rank,
  name: '',
  italic: rank === 'Género' || rank === 'Especie',
}));

const toFormValues = (c) => ({
  species_id: c?.species_id ?? null,
  slug: c?.slug ?? '',
  published: !!c?.published,
  authority: c?.authority ?? '',
  origin: c?.origin ?? '',
  difficulty: c?.difficulty ?? '',
  summary: c?.summary ?? '',
  taxonomy: c ? (c.taxonomy ?? []) : NEW_TAXONOMY,
  facts: c?.facts ?? [],
  basics: (c?.basics ?? []).map((text) => ({ text })),
  references: (c?.references ?? []).map((r) => ({ text: r.text, url: r.url ?? '' })),
  body: c?.body ?? '',
  photos: c?.photos ?? [],
  video_src: c?.video?.src ?? '',
  video_alt: c?.video?.alt ?? '',
});

// Filas vacías no viajan; los textos opcionales vacíos van como null
const toPayload = (d, isEdit) => ({
  species_id: d.species_id,
  ...((isEdit || d.slug) && { slug: d.slug }),
  published: d.published,
  authority: d.authority || null,
  origin: d.origin || null,
  difficulty: d.difficulty || null,
  summary: d.summary,
  taxonomy: d.taxonomy.filter((r) => r.name),
  facts: d.facts.filter((f) => f.label || f.value),
  basics: d.basics.map((b) => b.text).filter(Boolean),
  body: d.body.trim() ? d.body : null,
  photos: d.photos,
  video: d.video_src ? { src: d.video_src, alt: d.video_alt } : null,
  references: d.references.filter((r) => r.text).map((r) => ({ text: r.text, url: r.url || null })),
});

const BODY_HELP =
  'Cada sección empieza con ## Título. **negritas**, *cursivas*, listas con - y tablas Markdown';

// ----------------------------------------------------------------------

function Section({ title, help, children }) {
  return (
    <Card component="section" aria-label={title} sx={{ p: 3 }}>
      <Typography variant="h6">{title}</Typography>
      {help && (
        <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
          {help}
        </Typography>
      )}
      <Box sx={{ mt: 2.5 }}>{children}</Box>
    </Card>
  );
}

// Lista editable: una fila por elemento, «Quitar» por fila y «+ Agregar fila» abajo
function RowList({ name, emptyRow, renderRow }) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });

  return (
    <Stack spacing={1.5}>
      {fields.map((item, index) => (
        <Box key={item.id} sx={{ gap: 1.5, display: 'flex', alignItems: 'flex-start' }}>
          {renderRow(index)}
          <Button color="error" onClick={() => remove(index)} sx={{ mt: 1, flexShrink: 0 }}>
            Quitar
          </Button>
        </Box>
      ))}
      <Box>
        <Button variant="outlined" onClick={() => append(emptyRow)}>
          + Agregar fila
        </Button>
      </Box>
    </Stack>
  );
}

// ----------------------------------------------------------------------

export function CareSheetForm({ current }) {
  const navigate = useNavigate();
  const isEdit = !!current;

  const { species: allSpecies } = useAllSpecies();

  const methods = useForm({
    resolver: zodResolver(makeSchema(isEdit)),
    defaultValues: toFormValues(current),
  });

  const {
    watch,
    control,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const photos = useFieldArray({ control, name: 'photos' });
  const videoSrc = watch('video_src');

  const [photoUrl, setPhotoUrl] = useState('');
  const [photoUrlError, setPhotoUrlError] = useState('');
  const [photosLoading, setPhotosLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);

  const uploadPhotos = async (files) => {
    setPhotosLoading(true);
    try {
      const urls = await Promise.all(files.map((file) => uploadToCloudinary(file)));
      photos.append(urls.map((src) => ({ src, alt: '' })));
    } catch {
      toast.error('Error al subir las fotos');
    } finally {
      setPhotosLoading(false);
    }
  };

  const addPhotoUrl = () => {
    const src = photoUrl.trim();
    if (!isHttps(src)) {
      setPhotoUrlError('Debe empezar con https://');
      return;
    }
    photos.append({ src, alt: '' });
    setPhotoUrl('');
    setPhotoUrlError('');
  };

  const uploadVideo = async (file) => {
    setVideoLoading(true);
    try {
      const url = await uploadToCloudinary(file, 'video');
      setValue('video_src', url, { shouldDirty: true, shouldValidate: true });
    } catch {
      toast.error('Error al subir el video');
    } finally {
      setVideoLoading(false);
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = toPayload(data, isEdit);
      const saved = isEdit
        ? await updateCareSheet(current.id, payload)
        : await createCareSheet(payload);
      // revalidateIfStale=false: sin esto la lista y la ficha se quedan con lo viejo
      mutate(endpoints.careSheet.list);
      if (saved?.id) mutate(endpoints.careSheet.details(saved.id));
      toast.success(isEdit ? 'Ficha actualizada' : 'Ficha creada');
      navigate(paths.dashboard.careSheet.root);
    } catch (error) {
      toast.error(error.message || 'Error al guardar la ficha');
    }
  });

  const grid2 = { gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } };

  return (
    <FormProvider {...methods}>
      <FormLeaveGuard />
      <form onSubmit={onSubmit}>
        <Stack spacing={3}>
          <Section title="Especie y publicación">
            <Box sx={grid2}>
              <Controller
                name="species_id"
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <Autocomplete
                    options={allSpecies}
                    value={allSpecies.find((s) => s.id === field.value) ?? null}
                    onChange={(_, option) => field.onChange(option?.id ?? null)}
                    getOptionLabel={(option) => speciesLabel(option)}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Especie *"
                        error={!!error}
                        helperText={error?.message ?? 'Una ficha por especie'}
                      />
                    )}
                  />
                )}
              />
              <Field.Text
                name="slug"
                label={isEdit ? 'Slug *' : 'Slug (opcional)'}
                helperText={
                  isEdit
                    ? `Actual: ${current.slug}. Cambiarlo rompe los enlaces viejos`
                    : 'Se arma solo si lo dejas vacío'
                }
              />
              <Field.Switch name="published" label="Publicada (visible en el sitio)" />
            </Box>
          </Section>

          <Section title="Datos generales">
            <Box sx={grid2}>
              <Field.Text
                name="authority"
                label="Autoridad"
                placeholder="Cumming, Bank, Le Tirant & Bradler, 2020"
              />
              <Field.Text name="origin" label="Origen" placeholder="Java, Indonesia" />
              <Field.Text name="difficulty" label="Dificultad" placeholder="Fácil" />
              <Field.Text
                name="summary"
                label="Resumen *"
                multiline
                minRows={3}
                helperText="Máximo 600 caracteres"
                sx={{ gridColumn: { sm: 'span 2' } }}
              />
            </Box>
          </Section>

          <Section
            title="Ficha técnica"
            help="Orden, familia, género, especie, localidad tipo… Las filas sin nombre no se guardan."
          >
            <RowList
              name="taxonomy"
              emptyRow={{ rank: '', name: '', italic: false }}
              renderRow={(i) => (
                <>
                  <Field.Text name={`taxonomy.${i}.rank`} label="Rango" sx={{ maxWidth: 200 }} />
                  <Field.Text name={`taxonomy.${i}.name`} label="Nombre" />
                  <Controller
                    name={`taxonomy.${i}.italic`}
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        label="Itálica"
                        sx={{ mt: 1, flexShrink: 0 }}
                        control={
                          <Checkbox
                            checked={!!field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                          />
                        }
                      />
                    )}
                  />
                </>
              )}
            />
          </Section>

          <Section title="Datos rápidos" help="Hembra adulta: 6.5–7.5 cm, Humedad: 70–80 %…">
            <RowList
              name="facts"
              emptyRow={{ label: '', value: '' }}
              renderRow={(i) => (
                <>
                  <Field.Text name={`facts.${i}.label`} label="Etiqueta" sx={{ maxWidth: 260 }} />
                  <Field.Text name={`facts.${i}.value`} label="Valor" />
                </>
              )}
            />
          </Section>

          <Section title="Lo básico" help="Una idea por fila. Admite *cursivas*.">
            <RowList
              name="basics"
              emptyRow={{ text: '' }}
              renderRow={(i) => <Field.Text name={`basics.${i}.text`} label="Texto" />}
            />
          </Section>

          <Section title="Cuerpo" help={BODY_HELP}>
            <Field.Text
              name="body"
              label="Cuerpo (Markdown)"
              multiline
              minRows={18}
              sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 14 } }}
            />
          </Section>

          <Section title="Fotos y video">
            <Stack spacing={2}>
              {photos.fields.map((photo, index) => (
                <Box key={photo.id} sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
                  <Box
                    component="img"
                    src={photo.src}
                    alt={photo.alt}
                    sx={{
                      width: 96,
                      height: 72,
                      flexShrink: 0,
                      borderRadius: 1,
                      objectFit: 'cover',
                    }}
                  />
                  <Field.Text name={`photos.${index}.alt`} label="Texto alternativo" />
                  <Button color="error" onClick={() => photos.remove(index)} sx={{ flexShrink: 0 }}>
                    Quitar
                  </Button>
                </Box>
              ))}

              <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <Button component="label" variant="outlined" loading={photosLoading}>
                  + Subir fotos
                  <input
                    hidden
                    multiple
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.length) uploadPhotos([...e.target.files]);
                      e.target.value = '';
                    }}
                  />
                </Button>
                <TextField
                  size="small"
                  label="o pega una URL"
                  value={photoUrl}
                  error={!!photoUrlError}
                  helperText={photoUrlError}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  sx={{ minWidth: 280 }}
                />
                <Button variant="outlined" onClick={addPhotoUrl} disabled={!photoUrl.trim()}>
                  + Agregar URL
                </Button>
              </Box>

              <Typography variant="subtitle2" sx={{ pt: 2 }}>
                Video
              </Typography>
              {videoSrc && (
                <Box
                  component="video"
                  src={videoSrc}
                  controls
                  sx={{ width: 320, maxWidth: 1, borderRadius: 1.5 }}
                />
              )}
              <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <Button component="label" variant="outlined" loading={videoLoading}>
                  {videoSrc ? 'Cambiar video' : '+ Subir video'}
                  <input
                    hidden
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) uploadVideo(e.target.files[0]);
                      e.target.value = '';
                    }}
                  />
                </Button>
                <Field.Text
                  name="video_src"
                  label="o pega una URL"
                  size="small"
                  sx={{ maxWidth: 360 }}
                />
                {videoSrc && (
                  <Button
                    color="error"
                    onClick={() => setValue('video_src', '', { shouldDirty: true })}
                  >
                    Quitar video
                  </Button>
                )}
              </Box>
              {videoSrc && <Field.Text name="video_alt" label="Texto alternativo del video" />}
            </Stack>
          </Section>

          <Section title="Referencias" help="La URL es opcional.">
            <RowList
              name="references"
              emptyRow={{ text: '', url: '' }}
              renderRow={(i) => (
                <>
                  <Field.Text name={`references.${i}.text`} label="Texto" />
                  <Field.Text name={`references.${i}.url`} label="URL" sx={{ maxWidth: 320 }} />
                </>
              )}
            />
          </Section>

          <Box sx={{ gap: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
            <Button component={RouterLink} href={paths.dashboard.careSheet.root} color="inherit">
              Cancelar
            </Button>
            <Button type="submit" variant="contained" loading={isSubmitting}>
              {isEdit ? 'Guardar cambios' : 'Crear ficha'}
            </Button>
          </Box>
        </Stack>
      </form>
    </FormProvider>
  );
}
