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

import { handleApiError } from 'src/utils/handle-api-error';

import { endpoints } from 'src/lib/axios';
import { createBranch, updateBranch } from 'src/actions/branch';

import { toast } from 'src/components/snackbar';
import { Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const schema = zod.object({
  name: zod.string().min(1, 'El nombre es requerido'),
  address: zod.string().optional(),
  phone: zod.string().optional(),
  email: zod.string().email('Email inválido').optional().or(zod.literal('')),
  is_active: zod.boolean().default(true),
});

// ----------------------------------------------------------------------

export function BranchCreateEditForm({ currentBranch }) {
  const navigate = useNavigate();
  const isEdit = !!currentBranch;

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: currentBranch?.name ?? '',
      address: currentBranch?.address ?? '',
      phone: currentBranch?.phone ?? '',
      email: currentBranch?.email ?? '',
      is_active: currentBranch?.is_active ?? true,
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
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        is_active: data.is_active,
      };

      if (isEdit) {
        await updateBranch(currentBranch.id, payload);
      } else {
        await createBranch(payload);
      }

      toast.success(isEdit ? 'Sucursal actualizada' : 'Sucursal creada');
      mutate((key) => Array.isArray(key) && key[0] === endpoints.branch.list);
      navigate(paths.dashboard.branch.root);
    } catch (error) {
      if (!handleApiError(error, setError)) {
        toast.error('Error al guardar la sucursal');
      }
    }
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Información de la sucursal
          </Typography>

          <Box sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Field.Text name="name" label="Nombre *" sx={{ gridColumn: { sm: 'span 2' } }} />
            <Field.Text
              name="address"
              label="Dirección"
              sx={{ gridColumn: { sm: 'span 2' } }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Field.Text
              name="phone"
              label="Teléfono"
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Field.Text
              name="email"
              label="Email"
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Field.Switch name="is_active" label="Activa" />
          </Box>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
              {isEdit ? 'Guardar cambios' : 'Crear sucursal'}
            </LoadingButton>
          </Box>
        </Card>
      </form>
    </FormProvider>
  );
}
