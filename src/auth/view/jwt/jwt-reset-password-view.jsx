import * as z from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import { useBoolean } from 'minimal-shared/hooks';
import { zodResolver } from '@hookform/resolvers/zod';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import axios, { endpoints } from 'src/lib/axios';

import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

import { FormHead } from '../../components/form-head';
import { FormReturnLink } from '../../components/form-return-link';

// ----------------------------------------------------------------------

const ResetPasswordSchema = z
  .object({
    new_password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
      .regex(/[0-9]/, 'Debe contener al menos un número'),
    confirm_password: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm_password'],
  });

// ----------------------------------------------------------------------

export function JwtResetPasswordView() {
  const router = useRouter();
  const showPassword = useBoolean();
  const showConfirm = useBoolean();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [errorMessage, setErrorMessage] = useState(null);

  const methods = useForm({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { new_password: '', confirm_password: '' },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    if (!token) {
      setErrorMessage('El enlace es inválido. Solicita uno nuevo.');
      return;
    }
    try {
      await axios.post(endpoints.auth.resetPassword, {
        token,
        new_password: data.new_password,
      });
      router.push(`${paths.auth.jwt.signIn}?passwordReset=1`);
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setErrorMessage(
        typeof detail === 'string' ? detail : 'El enlace es inválido o ha expirado. Solicita uno nuevo.'
      );
    }
  });

  const passwordEndAdornment = (show, onToggle) => (
    <InputAdornment position="end">
      <IconButton onClick={onToggle} edge="end">
        <Iconify icon={show ? 'solar:eye-bold' : 'solar:eye-closed-bold'} />
      </IconButton>
    </InputAdornment>
  );

  if (!token) {
    return (
      <>
        <FormHead
          title="Enlace inválido"
          description="Este enlace no es válido. Solicita un nuevo enlace de restablecimiento."
        />
        <FormReturnLink href={paths.auth.jwt.forgotPassword} label="Solicitar nuevo enlace" />
      </>
    );
  }

  return (
    <>
      <FormHead
        title="Nueva contraseña"
        description="Ingresa tu nueva contraseña. Debe tener al menos 8 caracteres, una mayúscula y un número."
      />

      {!!errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      )}

      <Form methods={methods} onSubmit={onSubmit}>
        <Field.Text
          name="new_password"
          label="Nueva contraseña"
          type={showPassword.value ? 'text' : 'password'}
          slotProps={{
            inputLabel: { shrink: true },
            input: { endAdornment: passwordEndAdornment(showPassword.value, showPassword.onToggle) },
          }}
          sx={{ mb: 2.5 }}
        />

        <Field.Text
          name="confirm_password"
          label="Confirmar contraseña"
          type={showConfirm.value ? 'text' : 'password'}
          slotProps={{
            inputLabel: { shrink: true },
            input: { endAdornment: passwordEndAdornment(showConfirm.value, showConfirm.onToggle) },
          }}
          sx={{ mb: 3 }}
        />

        <Button
          fullWidth
          color="inherit"
          size="large"
          type="submit"
          variant="contained"
          loading={isSubmitting}
          loadingIndicator="Guardando..."
        >
          Restablecer contraseña
        </Button>
      </Form>

      <FormReturnLink href={paths.auth.jwt.signIn} label="Volver al inicio de sesión" sx={{ mt: 3 }} />
    </>
  );
}
