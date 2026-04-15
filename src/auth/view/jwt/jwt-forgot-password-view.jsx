import * as z from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

import { paths } from 'src/routes/paths';

import axios, { endpoints } from 'src/lib/axios';

import { Form, Field } from 'src/components/hook-form';

import { FormHead } from '../../components/form-head';
import { FormReturnLink } from '../../components/form-return-link';

// ----------------------------------------------------------------------

const ForgotPasswordSchema = z.object({
  email: z.string().email('Email inválido').min(1, 'El email es requerido'),
});

// ----------------------------------------------------------------------

export function JwtForgotPasswordView() {
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const methods = useForm({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      await axios.post(endpoints.auth.forgotPassword, { email: data.email });
      setSent(true);
    } catch {
      setErrorMessage('Ocurrió un error. Intenta de nuevo más tarde.');
    }
  });

  if (sent) {
    return (
      <>
        <FormHead
          title="Revisa tu correo"
          description="Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos."
        />
        <FormReturnLink href={paths.auth.jwt.signIn} label="Volver al inicio de sesión" />
      </>
    );
  }

  return (
    <>
      <FormHead
        title="¿Olvidaste tu contraseña?"
        description="Ingresa tu correo y te enviaremos un enlace para restablecerla."
      />

      {!!errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      )}

      <Form methods={methods} onSubmit={onSubmit}>
        <Field.Text
          name="email"
          label="Correo electrónico"
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ mb: 3 }}
        />

        <Button
          fullWidth
          color="inherit"
          size="large"
          type="submit"
          variant="contained"
          loading={isSubmitting}
          loadingIndicator="Enviando..."
        >
          Enviar enlace
        </Button>
      </Form>

      <FormReturnLink href={paths.auth.jwt.signIn} label="Volver al inicio de sesión" sx={{ mt: 3 }} />
    </>
  );
}
