import { z as zod } from 'zod';
import { useNavigate } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';

import { useGetRoles } from 'src/actions/role';
import { useGetBranches } from 'src/actions/sale';
import { createUser, updateUser } from 'src/actions/user';

import { toast } from 'src/components/snackbar';
import { Field } from 'src/components/hook-form';
import { AvatarPicker } from 'src/components/avatar-picker';

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

// ----------------------------------------------------------------------

export function UserCreateEditForm({ currentUser }) {
  const navigate = useNavigate();
  const { roles } = useGetRoles();
  const { branches } = useGetBranches();

  const isEdit = !!currentUser;
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

  const toAbsoluteUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    if (url.startsWith('http')) return url;
    return `${window.location.origin}${url}`;
  };

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
        avatar: toAbsoluteUrl(data.avatar),
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

              <Box sx={{ gridColumn: { sm: 'span 2' } }}>
                <AvatarPicker
                  value={avatarUrl}
                  onChange={(url) => methods.setValue('avatar', url, { shouldValidate: true })}
                />
              </Box>

              <Field.Text
                name="avatar"
                label="O ingresa una URL personalizada"
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
  );
}
