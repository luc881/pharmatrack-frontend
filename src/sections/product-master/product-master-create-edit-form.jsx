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
import { createProductMaster, updateProductMaster } from 'src/actions/product-master';

import { toast } from 'src/components/snackbar';

import { handleApiError } from 'src/utils/handle-api-error';
import { Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const schema = zod.object({
  name: zod.string().min(1, 'El nombre es requerido'),
  description: zod.string().optional(),
  is_active: zod.boolean().default(true),
});

// ----------------------------------------------------------------------

export function ProductMasterCreateEditForm({ currentProductMaster }) {
  const navigate = useNavigate();
  const isEdit = !!currentProductMaster;

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: currentProductMaster?.name ?? '',
      description: currentProductMaster?.description ?? '',
      is_active: currentProductMaster?.is_active ?? true,
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
        await updateProductMaster(currentProductMaster.id, payload);
      } else {
        await createProductMaster(payload);
      }

      toast.success(isEdit ? 'Principio activo actualizado' : 'Principio activo creado');
      mutate((key) => Array.isArray(key) && key[0] === endpoints.productMaster.list);
      navigate(paths.dashboard.productMaster.root);
    } catch (error) {
      if (!handleApiError(error, setError)) {
        toast.error('Error al guardar el principio activo');
      }
    }
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Información del principio activo
          </Typography>

          <Box sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Field.Text name="name" label="Nombre (INN) *" sx={{ gridColumn: { sm: 'span 2' } }} />
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
              {isEdit ? 'Guardar cambios' : 'Crear principio activo'}
            </LoadingButton>
          </Box>
        </Card>
      </form>
    </FormProvider>
  );
}
