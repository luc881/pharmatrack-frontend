import { mutate } from 'swr';
import { z as zod } from 'zod';
import { useNavigate } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';

import { endpoints } from 'src/lib/axios';
import { createProductCategory, updateProductCategory, useGetAllProductCategories } from 'src/actions/product-category';

import { toast } from 'src/components/snackbar';

import { handleApiError } from 'src/utils/handle-api-error';
import { Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const schema = zod.object({
  name: zod.string().min(1, 'El nombre es requerido'),
  parent_id: zod.union([zod.string(), zod.number()]).optional().nullable(),
  image: zod.string().optional(),
  is_active: zod.boolean().default(true),
});

// ----------------------------------------------------------------------

export function ProductCategoryCreateEditForm({ currentCategory }) {
  const navigate = useNavigate();
  const { categories } = useGetAllProductCategories();
  const isEdit = !!currentCategory;

  // Only root categories as parent options (avoid cycles)
  const rootCategories = categories.filter((c) => c.parent_id === null && c.id !== currentCategory?.id);

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: currentCategory?.name ?? '',
      parent_id: currentCategory?.parent_id ?? '',
      image: currentCategory?.image ?? '',
      is_active: currentCategory?.is_active ?? true,
    },
  });

  const { setError, handleSubmit, formState: { isSubmitting } } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = {
        name: data.name,
        parent_id: data.parent_id ? Number(data.parent_id) : null,
        image: data.image || null,
        is_active: data.is_active,
      };

      if (isEdit) {
        await updateProductCategory(currentCategory.id, payload);
      } else {
        await createProductCategory(payload);
      }

      toast.success(isEdit ? 'Categoría actualizada' : 'Categoría creada');
      mutate((key) => Array.isArray(key) && key[0] === endpoints.productCategory.list);
      navigate(paths.dashboard.productCategory.root);
    } catch (error) {
      if (!handleApiError(error, setError)) {
        toast.error('Error al guardar la categoría');
      }
    }
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Información de la categoría
          </Typography>

          <Box sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Field.Text name="name" label="Nombre *" sx={{ gridColumn: { sm: 'span 2' } }} />

            <Field.Select name="parent_id" label="Categoría padre (opcional)">
              <MenuItem value="">Sin categoría padre (raíz)</MenuItem>
              {rootCategories.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Field.Select>

            <Field.Text
              name="image"
              label="URL de imagen"
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <Field.Switch name="is_active" label="Activa" />
          </Box>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
              {isEdit ? 'Guardar cambios' : 'Crear categoría'}
            </LoadingButton>
          </Box>
        </Card>
      </form>
    </FormProvider>
  );
}
