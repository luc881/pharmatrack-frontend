import { z as zod } from 'zod';
import { useNavigate } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';

import { createProductBrand, updateProductBrand } from 'src/actions/product-brand';

import { toast } from 'src/components/snackbar';
import { Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const schema = zod.object({
  name: zod.string().min(1, 'El nombre es requerido'),
  logo: zod.string().optional(),
});

// ----------------------------------------------------------------------

export function ProductBrandCreateEditForm({ currentBrand }) {
  const navigate = useNavigate();
  const isEdit = !!currentBrand;

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: currentBrand?.name ?? '',
      logo: currentBrand?.logo ?? '',
    },
  });

  const { watch, handleSubmit, formState: { isSubmitting } } = methods;

  const logoUrl = watch('logo');
  const nameValue = watch('name');

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = { name: data.name, logo: data.logo || null };
      if (isEdit) {
        await updateProductBrand(currentBrand.id, payload);
      } else {
        await createProductBrand(payload);
      }
      toast.success(isEdit ? 'Marca actualizada' : 'Marca creada');
      navigate(paths.dashboard.productBrand.root);
    } catch {
      toast.error('Error al guardar la marca');
    }
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit}>
        <Card sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
            <Avatar
              src={logoUrl || ''}
              variant="rounded"
              sx={{ width: 64, height: 64, bgcolor: 'background.neutral' }}
            >
              {nameValue?.[0]?.toUpperCase()}
            </Avatar>
            <Typography variant="h6">{nameValue || 'Nueva marca'}</Typography>
          </Box>

          <Box sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Field.Text name="name" label="Nombre de la marca *" />
            <Field.Text
              name="logo"
              label="URL del logo"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
              {isEdit ? 'Guardar cambios' : 'Crear marca'}
            </LoadingButton>
          </Box>
        </Card>
      </form>
    </FormProvider>
  );
}
