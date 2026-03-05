import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import CardHeader from '@mui/material/CardHeader';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { createSupplier, updateSupplier } from 'src/actions/supplier';

import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const SupplierSchema = z.object({
  name: z.string().min(1, { error: 'El nombre es requerido' }),
  email: z.string().email({ error: 'Email inválido' }).or(z.literal('')).nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  rfc: z.string().nullable(),
  logo: z.string().nullable(),
  is_active: z.boolean(),
});

// ----------------------------------------------------------------------

export function SupplierCreateEditForm({ currentSupplier }) {
  const router = useRouter();

  const defaultValues = {
    name: '',
    email: '',
    phone: '',
    address: '',
    rfc: '',
    logo: '',
    is_active: true,
  };

  const methods = useForm({
    resolver: zodResolver(SupplierSchema),
    defaultValues,
    values: currentSupplier,
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    const payload = {
      ...data,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      rfc: data.rfc || null,
      logo: data.logo || null,
    };

    try {
      if (currentSupplier) {
        await updateSupplier(currentSupplier.id, payload);
        toast.success('Proveedor actualizado');
      } else {
        await createSupplier(payload);
        toast.success('Proveedor creado');
        reset();
      }
      router.push(paths.dashboard.supplier.root);
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar el proveedor');
    }
  });

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Stack spacing={{ xs: 3, md: 5 }} sx={{ mx: 'auto', maxWidth: { xs: 720, xl: 880 } }}>
        <Card>
          <CardHeader title="Información" subheader="Datos del proveedor" sx={{ mb: 3 }} />

          <Divider />

          <Stack spacing={3} sx={{ p: 3 }}>
            <Field.Text name="name" label="Nombre / Razón social" />

            <Box
              sx={{
                columnGap: 2,
                rowGap: 3,
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' },
              }}
            >
              <Field.Text name="email" label="Email" type="email" />
              <Field.Text name="phone" label="Teléfono" />
              <Field.Text name="rfc" label="RFC" />
              <Field.Text name="logo" label="URL de logo" />
            </Box>

            <Field.Text name="address" label="Dirección" multiline rows={3} />
          </Stack>
        </Card>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <FormControlLabel
            label="Activo"
            control={
              <Switch
                defaultChecked
                slotProps={{ input: { id: 'is-active-switch' } }}
                {...methods.register('is_active')}
              />
            }
            sx={{ pl: 3, flexGrow: 1 }}
          />

          <Button type="submit" variant="contained" size="large" loading={isSubmitting}>
            {currentSupplier ? 'Guardar cambios' : 'Crear proveedor'}
          </Button>
        </Box>
      </Stack>
    </Form>
  );
}
