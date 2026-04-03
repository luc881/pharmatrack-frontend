import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useBoolean } from 'minimal-shared/hooks';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';

import { changePassword } from 'src/actions/user';

import { useAuthContext } from 'src/auth/hooks';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const schema = z
  .object({
    oldPassword: z.string().min(1, 'La contraseña actual es requerida'),
    newPassword: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
      .regex(/[0-9]/, 'Debe contener al menos un número'),
    confirmNewPassword: z.string().min(1, 'Confirmá la nueva contraseña'),
  })
  .refine((val) => val.oldPassword !== val.newPassword, {
    message: 'La nueva contraseña no puede ser igual a la anterior',
    path: ['newPassword'],
  })
  .refine((val) => val.newPassword === val.confirmNewPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmNewPassword'],
  });

// ----------------------------------------------------------------------

export function AccountChangePassword() {
  const { user } = useAuthContext();
  const showPassword = useBoolean();

  const methods = useForm({
    mode: 'all',
    resolver: zodResolver(schema),
    defaultValues: { oldPassword: '', newPassword: '', confirmNewPassword: '' },
  });

  const { reset, handleSubmit, formState: { isSubmitting } } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      await changePassword(user.id, {
        old_password: data.oldPassword,
        new_password: data.newPassword,
      });
      reset();
      toast.success('Contraseña actualizada correctamente');
    } catch (err) {
      toast.error(err?.message || 'Error al cambiar la contraseña');
    }
  });

  const eyeAdornment = (
    <InputAdornment position="end">
      <IconButton onClick={showPassword.onToggle} edge="end">
        <Iconify icon={showPassword.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'} />
      </IconButton>
    </InputAdornment>
  );

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Card sx={{ p: 3, gap: 3, display: 'flex', flexDirection: 'column' }}>
        <Field.Text
          name="oldPassword"
          label="Contraseña actual"
          type={showPassword.value ? 'text' : 'password'}
          slotProps={{ input: { endAdornment: eyeAdornment } }}
        />

        <Field.Text
          name="newPassword"
          label="Nueva contraseña"
          type={showPassword.value ? 'text' : 'password'}
          slotProps={{ input: { endAdornment: eyeAdornment } }}
          helperText={
            <Box component="span" sx={{ gap: 0.5, display: 'flex', alignItems: 'center' }}>
              <Iconify icon="solar:info-circle-bold" width={16} />
              Mínimo 8 caracteres, una mayúscula y un número
            </Box>
          }
        />

        <Field.Text
          name="confirmNewPassword"
          label="Confirmar nueva contraseña"
          type={showPassword.value ? 'text' : 'password'}
          slotProps={{ input: { endAdornment: eyeAdornment } }}
        />

        <Button type="submit" variant="contained" loading={isSubmitting} sx={{ ml: 'auto' }}>
          Actualizar contraseña
        </Button>
      </Card>
    </Form>
  );
}
