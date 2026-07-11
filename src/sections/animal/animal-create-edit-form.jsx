import { mutate } from 'swr';
import { z as zod } from 'zod';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';

import { endpoints } from 'src/lib/axios';
import { useAllMorphs, createAnimal, updateAnimal, useAllSpecies } from 'src/actions/animal';

import { toast } from 'src/components/snackbar';
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
        }
      : undefined,
  });

  const {
    watch,
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
      toast.error(error.message || 'Error al guardar el animal');
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
