import * as z from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { handleApiError } from 'src/utils/handle-api-error';

import { createSupplier, updateSupplier } from 'src/actions/supplier';
import { keepInCloudinary, uploadToCloudinary } from 'src/lib/cloudinary';

import { toast } from 'src/components/snackbar';
import { Form, Field, FormLeaveGuard } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-V0-9]{3}$/;

const SupplierSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(255, 'Máximo 255 caracteres'),
  email: z.string().email('Email inválido').or(z.literal('')).nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  rfc: z
    .string()
    .nullable()
    .refine((v) => !v || RFC_REGEX.test(v), {
      message: 'RFC inválido — formato esperado: XXXX000000XXX',
    }),
  logo: z.string().nullable(),
  // su ticket en la venta rápida (un ticket por dueño)
  ticket_prefix: z
    .string()
    .regex(/^[A-Za-z0-9]{0,6}$/, 'Letras y números, hasta 6')
    .nullable(),
  ticket_lines: z.string().max(400, 'Máximo 400 caracteres').nullable(),
  ticket_qr_url: z
    .string()
    .nullable()
    .refine((v) => !v || /^https?:\/\//.test(v), { message: 'Debe empezar con https://' }),
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
    ticket_prefix: '',
    ticket_lines: '',
    ticket_qr_url: '',
    is_active: true,
  };

  const methods = useForm({
    resolver: zodResolver(SupplierSchema),
    defaultValues,
    values: currentSupplier,
  });

  const {
    reset,
    watch,
    setValue,
    setError,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const logo = watch('logo');
  const [uploading, setUploading] = useState(false);
  const uploadLogo = async (file) => {
    setUploading(true);
    try {
      setValue('logo', await uploadToCloudinary(file), { shouldDirty: true });
    } catch {
      toast.error('No se pudo subir el logo');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    const payload = {
      ...data,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      rfc: data.rfc || null,
      ticket_prefix: data.ticket_prefix || null,
      ticket_lines: data.ticket_lines?.trim() || null,
      ticket_qr_url: data.ticket_qr_url || null,
    };

    try {
      // un link de otra página se copia a Cloudinary (no se rompe si lo borran)
      payload.logo = (await keepInCloudinary(data.logo)) || null;
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
      if (!handleApiError(error, setError)) {
        toast.error('Error al guardar el proveedor');
      }
    }
  });

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <FormLeaveGuard />
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
            </Box>

            {/* el logo se imprime en su ticket: mejor en negro sobre fondo transparente */}
            <Box sx={{ gap: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
              {logo && (
                <Box
                  component="img"
                  src={logo}
                  alt="Logo del proveedor"
                  sx={{ width: 72, height: 72, objectFit: 'contain', bgcolor: '#fff', borderRadius: 1 }}
                />
              )}
              <Button component="label" variant="outlined" loading={uploading}>
                {logo ? 'Cambiar logo' : '+ Subir logo'}
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) uploadLogo(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
              </Button>
              <Field.Text name="logo" label="o pega un link del logo" size="small" sx={{ flex: 1, minWidth: 240 }} />
            </Box>

            <Field.Text name="address" label="Dirección" multiline rows={3} />
          </Stack>
        </Card>

        <Card>
          <CardHeader
            title="Ticket en la venta rápida"
            subheader="Si vende en tu stand, sus productos salen en un ticket aparte con su logo y estos datos. Lo que dejes vacío no se imprime."
            sx={{ mb: 3 }}
          />
          <Divider />
          <Stack spacing={3} sx={{ p: 3 }}>
            <Field.Text
              name="ticket_prefix"
              label="Prefijo del folio"
              helperText="BD → BD-0001. Letras y números, hasta 6."
              sx={{ maxWidth: 240 }}
            />
            <Field.Text
              name="ticket_lines"
              label="Datos de contacto en el ticket"
              helperText="Uno por renglón: redes, teléfono, ciudad."
              multiline
              minRows={3}
            />
            <Field.Text
              name="ticket_qr_url"
              label="Link del QR"
              helperText="Opcional: sin link, su ticket sale sin QR."
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Para que sus productos salgan en su ticket, márcalo como «Proveedor dueño» en cada
              producto (o desde la venta rápida, en «Agregar productos»).
            </Typography>
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
