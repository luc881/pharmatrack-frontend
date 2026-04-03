import * as z from 'zod';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';

import { fData } from 'src/utils/format-number';

import { uploadToCloudinary } from 'src/lib/cloudinary';
import { updateUser, useGetUser } from 'src/actions/user';

import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';
import { AvatarPicker } from 'src/components/avatar-picker';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const GENDER_OPTIONS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
];

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  surname: z.string().optional(),
  phone: z.string().optional(),
  gender: z.string().optional(),
  avatar: z.any().optional(),
});

// ----------------------------------------------------------------------

export function AccountGeneral() {
  const { user: authUser } = useAuthContext();
  const { user, userLoading } = useGetUser(authUser?.id);

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      surname: '',
      phone: '',
      gender: '',
      avatar: null,
    },
    values: user
      ? {
          name: user.name ?? '',
          surname: user.surname ?? '',
          phone: user.phone ?? '',
          gender: user.gender ?? '',
          avatar: user.avatar ?? null,
        }
      : undefined,
  });

  const {
    watch,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const avatarValue = watch('avatar');

  const handleDropAvatar = useCallback(
    async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) return;
      try {
        const url = await uploadToCloudinary(file);
        setValue('avatar', url, { shouldValidate: true });
      } catch {
        toast.error('Error al subir la imagen');
      }
    },
    [setValue]
  );

  const toAbsoluteUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    if (url.startsWith('http')) return url;
    return `${window.location.origin}${url}`;
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      await updateUser(authUser.id, {
        name: data.name,
        surname: data.surname || null,
        phone: data.phone || null,
        gender: data.gender || null,
        avatar: toAbsoluteUrl(data.avatar),
      });
      toast.success('Perfil actualizado');
    } catch {
      toast.error('Error al actualizar el perfil');
    }
  });

  if (userLoading) return null;

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ pt: 10, pb: 5, px: 3, textAlign: 'center' }}>
            <Field.UploadAvatar
              name="avatar"
              value={avatarValue}
              onDrop={handleDropAvatar}
              maxSize={3145728}
              helperText={
                <Typography
                  variant="caption"
                  sx={{ mt: 3, mx: 'auto', display: 'block', textAlign: 'center', color: 'text.disabled' }}
                >
                  *.jpeg, *.jpg, *.png
                  <br /> máx. {fData(3145728)}
                </Typography>
              }
            />

            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2">{user?.email}</Typography>
              <Typography variant="body2" color="text.secondary">
                {authUser?.role}
              </Typography>
            </Box>

            <Box sx={{ mt: 3, textAlign: 'left' }}>
              <AvatarPicker
                value={avatarValue}
                onChange={(url) => setValue('avatar', url, { shouldValidate: true })}
              />
            </Box>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ p: 3 }}>
            <Box
              sx={{
                rowGap: 3,
                columnGap: 2,
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' },
              }}
            >
              <Field.Text name="name" label="Nombre *" />
              <Field.Text name="surname" label="Apellido" />
              <Field.Text name="phone" label="Teléfono" />
              <Field.Select name="gender" label="Género">
                <MenuItem value="">Sin especificar</MenuItem>
                {GENDER_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Field.Select>
            </Box>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" variant="contained" loading={isSubmitting}>
                Guardar cambios
              </Button>
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Form>
  );
}
