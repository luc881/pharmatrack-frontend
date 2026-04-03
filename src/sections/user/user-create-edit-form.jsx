import { z as zod } from 'zod';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';

import { useGetRoles } from 'src/actions/role';
import { useGetBranches } from 'src/actions/sale';
import { createUser, updateUser, changePassword } from 'src/actions/user';

import { useAuthContext } from 'src/auth/hooks';

import { toast } from 'src/components/snackbar';
import { Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const GENDER_OPTIONS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
];

const DOC_TYPE_OPTIONS = ['CURP', 'RFC', 'INE', 'Pasaporte', 'Otro'];

// ----------------------------------------------------------------------

const baseSchema = zod.object({
  name: zod.string().min(1, 'El nombre es requerido'),
  surname: zod.string().optional(),
  email: zod.string().email('Email inválido'),
  role_id: zod.union([zod.string(), zod.number()]).optional().nullable(),
  branch_id: zod.union([zod.string(), zod.number()]).optional().nullable(),
  phone: zod.string().optional(),
  gender: zod.string().optional(),
  type_document: zod.string().optional(),
  n_document: zod.string().optional(),
  avatar: zod.string().optional(),
});

const createSchema = baseSchema.extend({
  password: zod
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),
});

const editSchema = baseSchema;

const passwordSchema = zod
  .object({
    old_password: zod.string().min(1, 'La contraseña actual es requerida'),
    new_password: zod
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
      .regex(/[0-9]/, 'Debe contener al menos un número'),
    confirm_password: zod.string().min(1, 'Confirmá la contraseña'),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm_password'],
  });

// ----------------------------------------------------------------------

function ChangePasswordCard({ userId }) {
  const [submitting, setSubmitting] = useState(false);

  const methods = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { old_password: '', new_password: '', confirm_password: '' },
  });

  const { handleSubmit, reset } = methods;

  const onSubmit = handleSubmit(async (data) => {
    setSubmitting(true);
    try {
      await changePassword(userId, {
        old_password: data.old_password,
        new_password: data.new_password,
      });
      toast.success('Contraseña actualizada correctamente');
      reset();
    } catch (err) {
      const msg = err?.message || 'Error al cambiar la contraseña';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Card sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Cambiar contraseña
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Mínimo 8 caracteres, una mayúscula y un número.
      </Typography>

      <Divider sx={{ mb: 3, borderStyle: 'dashed' }} />

      <FormProvider {...methods}>
        <form onSubmit={onSubmit}>
          <Box
            sx={{
              gap: 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
            }}
          >
            <Field.Text name="old_password" label="Contraseña actual" type="password" />
            <Field.Text name="new_password" label="Nueva contraseña" type="password" />
            <Field.Text name="confirm_password" label="Confirmar contraseña" type="password" />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
            <LoadingButton type="submit" variant="contained" color="warning" loading={submitting}>
              Actualizar contraseña
            </LoadingButton>
          </Box>
        </form>
      </FormProvider>
    </Card>
  );
}

// ----------------------------------------------------------------------

export function UserCreateEditForm({ currentUser }) {
  const navigate = useNavigate();
  const { user: loggedInUser } = useAuthContext();
  const { roles } = useGetRoles();
  const { branches } = useGetBranches();

  const isEdit = !!currentUser;
  const isOwnProfile = isEdit && loggedInUser?.id === currentUser?.id;
  const schema = isEdit ? editSchema : createSchema;

  const defaultValues = {
    name: currentUser?.name ?? '',
    surname: currentUser?.surname ?? '',
    email: currentUser?.email ?? '',
    password: '',
    role_id: currentUser?.role_id ?? '',
    branch_id: currentUser?.branch_id ?? '',
    phone: currentUser?.phone ?? '',
    gender: currentUser?.gender ?? '',
    type_document: currentUser?.type_document ?? '',
    n_document: currentUser?.n_document ?? '',
    avatar: currentUser?.avatar ?? '',
  };

  const methods = useForm({ resolver: zodResolver(schema), defaultValues });

  const {
    watch,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const avatarUrl = watch('avatar');
  const nameValue = watch('name');

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = {
        name: data.name,
        surname: data.surname || null,
        email: data.email,
        role_id: data.role_id ? Number(data.role_id) : null,
        branch_id: data.branch_id ? Number(data.branch_id) : null,
        phone: data.phone || null,
        gender: data.gender || null,
        type_document: data.type_document || null,
        n_document: data.n_document || null,
        avatar: data.avatar || null,
      };

      if (isEdit) {
        await updateUser(currentUser.id, payload);
      } else {
        payload.password = data.password;
        await createUser(payload);
      }

      toast.success(isEdit ? 'Usuario actualizado' : 'Usuario creado');
      navigate(paths.dashboard.user.list);
    } catch {
      toast.error('Error al guardar el usuario');
    }
  });

  return (
    <Stack spacing={3}>
      <FormProvider {...methods}>
        <form onSubmit={onSubmit}>
          <Stack spacing={3}>
            {/* Avatar preview */}
            <Card sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Avatar src={avatarUrl || ''} sx={{ width: 72, height: 72, fontSize: 28 }}>
                {nameValue?.[0]?.toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="subtitle1">{nameValue || 'Nuevo usuario'}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Ingresa la URL del avatar abajo
                </Typography>
              </Box>
            </Card>

            {/* Personal info */}
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 3 }}>
                Información personal
              </Typography>

              <Box
                sx={{
                  gap: 2,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                }}
              >
                <Field.Text name="name" label="Nombre *" />
                <Field.Text name="surname" label="Apellido" />
                <Field.Text name="email" label="Email *" type="email" />
                {!isEdit && (
                  <Field.Text name="password" label="Contraseña *" type="password" />
                )}
                <Field.Text name="phone" label="Teléfono" />
                <Field.Select name="gender" label="Género">
                  <MenuItem value="">Sin especificar</MenuItem>
                  {GENDER_OPTIONS.map((g) => (
                    <MenuItem key={g.value} value={g.value}>
                      {g.label}
                    </MenuItem>
                  ))}
                </Field.Select>
                <Field.Select name="type_document" label="Tipo de documento">
                  <MenuItem value="">Sin especificar</MenuItem>
                  {DOC_TYPE_OPTIONS.map((d) => (
                    <MenuItem key={d} value={d}>
                      {d}
                    </MenuItem>
                  ))}
                </Field.Select>
                <Field.Text name="n_document" label="N° de documento" />
              </Box>
            </Card>

            {/* Role & Branch */}
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 3 }}>
                Acceso y sucursal
              </Typography>

              <Box
                sx={{
                  gap: 2,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                }}
              >
                <Field.Select name="role_id" label="Rol">
                  <MenuItem value="">Sin rol</MenuItem>
                  {roles.map((r) => (
                    <MenuItem key={r.id} value={r.id}>
                      {r.name}
                    </MenuItem>
                  ))}
                </Field.Select>

                <Field.Select name="branch_id" label="Sucursal">
                  <MenuItem value="">Sin sucursal</MenuItem>
                  {branches.map((b) => (
                    <MenuItem key={b.id} value={b.id}>
                      {b.name}
                    </MenuItem>
                  ))}
                </Field.Select>

                <Field.Text
                  name="avatar"
                  label="URL del avatar"
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ gridColumn: { sm: 'span 2' } }}
                />
              </Box>
            </Card>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                {isEdit ? 'Guardar cambios' : 'Crear usuario'}
              </LoadingButton>
            </Box>
          </Stack>
        </form>
      </FormProvider>

      {/* Password change — only visible when editing own profile */}
      {isOwnProfile && <ChangePasswordCard userId={currentUser.id} />}
    </Stack>
  );
}
