import { mutate } from 'swr';
import { z as zod } from 'zod';
import { useNavigate } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';

import { endpoints } from 'src/lib/axios';
import { createIngredient, updateIngredient } from 'src/actions/ingredient';

import { handleApiError } from 'src/utils/handle-api-error';

import { toast } from 'src/components/snackbar';
import { Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const schema = zod.object({
  name: zod.string().min(1, 'El nombre es requerido'),
  description: zod.string().optional(),
  is_active: zod.boolean().default(true),
});

// ----------------------------------------------------------------------

export function IngredientCreateEditForm({ currentIngredient }) {
  const navigate = useNavigate();
  const isEdit = !!currentIngredient;

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: currentIngredient?.name ?? '',
      description: currentIngredient?.description ?? '',
      is_active: currentIngredient?.is_active ?? true,
    },
  });

  const {
    setError,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = {
        name: data.name,
        description: data.description || null,
        is_active: data.is_active,
      };

      if (isEdit) {
        await updateIngredient(currentIngredient.id, payload);
      } else {
        await createIngredient(payload);
      }

      toast.success(isEdit ? 'Ingrediente actualizado' : 'Ingrediente creado');
      mutate((key) => Array.isArray(key) && key[0] === endpoints.ingredient.list);
      navigate(paths.dashboard.ingredient.root);
    } catch (error) {
      if (!handleApiError(error, setError)) {
        toast.error('Error al guardar el ingrediente');
      }
    }
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Información del ingrediente
          </Typography>

          <Box sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Field.Text name="name" label="Nombre *" sx={{ gridColumn: { sm: 'span 2' } }} />
            <Field.Text
              name="description"
              label="Descripción"
              multiline
              rows={3}
              sx={{ gridColumn: { sm: 'span 2' } }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Field.Switch name="is_active" label="Activo" />
          </Box>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
              {isEdit ? 'Guardar cambios' : 'Crear ingrediente'}
            </LoadingButton>
          </Box>
        </Card>
      </form>
    </FormProvider>
  );
}
