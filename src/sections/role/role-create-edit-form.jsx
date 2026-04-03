import { z as zod } from 'zod';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller, FormProvider } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';

import { createRole, updateRole, useGetPermissions } from 'src/actions/role';

import { toast } from 'src/components/snackbar';
import { Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const schema = zod.object({
  name: zod.string().min(1, 'El nombre es requerido'),
  permission_ids: zod.array(zod.number()).default([]),
});

// ----------------------------------------------------------------------

// Resources excluded from non-admin templates
const SYSTEM_RESOURCES = ['users', 'roles', 'permissions'];

// Resources for the pharmacy sales role
const SALES_RESOURCES = [
  'sales', 'saledetails', 'salepayments', 'salebatchusages',
  'saledetailattentions', 'refundproducts', 'clients',
];
const SALES_READ_RESOURCES = ['products', 'productbatches', 'branches'];

// Resources for the inventory role
const INVENTORY_RESOURCES = [
  'products', 'productbatches', 'productbrands', 'productmasters',
  'productscategories', 'productstockinitials', 'productwallets',
  'productwarehouses', 'ingredients', 'units', 'conversions',
  'suppliers', 'purchases', 'purchasedetails', 'warehouses', 'transports',
];

const TEMPLATES = [
  {
    label: 'Sin acceso',
    color: 'default',
    filter: () => false,
  },
  {
    label: 'Solo lectura',
    color: 'info',
    filter: (p) => p.name.endsWith('.read'),
  },
  {
    label: 'Farmacéutico',
    color: 'warning',
    filter: (p) => {
      const [resource, action] = p.name.split('.');
      if (SALES_RESOURCES.includes(resource)) return true;
      if (SALES_READ_RESOURCES.includes(resource)) return action === 'read';
      return false;
    },
  },
  {
    label: 'Inventario',
    color: 'secondary',
    filter: (p) => {
      const [resource] = p.name.split('.');
      return INVENTORY_RESOURCES.includes(resource);
    },
  },
  {
    label: 'Supervisor',
    color: 'primary',
    filter: (p) => {
      const [resource] = p.name.split('.');
      return !SYSTEM_RESOURCES.includes(resource);
    },
  },
  {
    label: 'Administrador',
    color: 'error',
    filter: () => true,
  },
];

// ----------------------------------------------------------------------

// Group permissions by resource prefix (e.g. "users.read" → "users")
function groupPermissions(permissions) {
  return permissions.reduce((acc, perm) => {
    const [resource] = perm.name.split('.');
    if (!acc[resource]) acc[resource] = [];
    acc[resource].push(perm);
    return acc;
  }, {});
}

// ----------------------------------------------------------------------

export function RoleCreateEditForm({ currentRole }) {
  const navigate = useNavigate();
  const { permissions, permissionsLoading } = useGetPermissions();
  const isEdit = !!currentRole;

  const currentPermissionIds = currentRole?.permissions?.map((p) => p.id) ?? [];

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: currentRole?.name ?? '',
      permission_ids: currentPermissionIds,
    },
  });

  const {
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const selectedIds = watch('permission_ids');
  const grouped = groupPermissions(permissions);

  // Unique action types across all permissions
  const allActions = useMemo(() => {
    const actions = new Set();
    permissions.forEach((p) => {
      const parts = p.name.split('.');
      if (parts.length > 1) actions.add(parts.slice(1).join('.'));
    });
    return [...actions].sort();
  }, [permissions]);

  // Action column label mapping
  const ACTION_LABELS = {
    read: 'Leer',
    create: 'Crear',
    update: 'Actualizar',
    delete: 'Eliminar',
  };

  const handleToggleAction = (action) => {
    const ids = permissions.filter((p) => p.name.endsWith(`.${action}`)).map((p) => p.id);
    const allSelected = ids.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setValue('permission_ids', selectedIds.filter((id) => !ids.includes(id)));
    } else {
      setValue('permission_ids', [...new Set([...selectedIds, ...ids])]);
    }
  };

  const isActionFullySelected = (action) => {
    const ids = permissions.filter((p) => p.name.endsWith(`.${action}`)).map((p) => p.id);
    return ids.length > 0 && ids.every((id) => selectedIds.includes(id));
  };

  const applyTemplate = (filter) => {
    const ids = permissions.filter(filter).map((p) => p.id);
    setValue('permission_ids', ids);
  };

  const handleToggleAll = (resourcePerms, checked) => {
    const ids = resourcePerms.map((p) => p.id);
    if (checked) {
      setValue('permission_ids', [...new Set([...selectedIds, ...ids])]);
    } else {
      setValue('permission_ids', selectedIds.filter((id) => !ids.includes(id)));
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = { name: data.name, permission_ids: data.permission_ids };
      if (isEdit) {
        await updateRole(currentRole.id, payload);
      } else {
        await createRole(payload);
      }
      toast.success(isEdit ? 'Rol actualizado' : 'Rol creado');
      navigate(paths.dashboard.role.root);
    } catch {
      toast.error('Error al guardar el rol');
    }
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit}>
        <Stack spacing={3}>
          {/* Name */}
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Información del rol
            </Typography>
            <Field.Text name="name" label="Nombre del rol *" sx={{ maxWidth: 400 }} />
          </Card>

          {/* Permissions */}
          <Card sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Permisos</Typography>
              <Chip
                size="small"
                label={`${selectedIds.length} seleccionados`}
                color={selectedIds.length > 0 ? 'primary' : 'default'}
                variant="soft"
              />
            </Box>

            {/* Templates */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                Plantillas rápidas
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {TEMPLATES.map((tpl) => (
                  <Chip
                    key={tpl.label}
                    label={tpl.label}
                    size="small"
                    color={tpl.color}
                    variant="soft"
                    clickable
                    onClick={() => applyTemplate(tpl.filter)}
                  />
                ))}
              </Stack>
            </Box>

            <Divider sx={{ mb: 2, borderStyle: 'dashed' }} />

            {/* Column action toggles */}
            {!permissionsLoading && allActions.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                  Seleccionar columna
                </Typography>
                <Stack direction="row" gap={1}>
                  {allActions.map((action) => {
                    const selected = isActionFullySelected(action);
                    return (
                      <Button
                        key={action}
                        size="small"
                        variant={selected ? 'contained' : 'outlined'}
                        color="inherit"
                        onClick={() => handleToggleAction(action)}
                        sx={{ minWidth: 100, fontSize: 12 }}
                      >
                        {ACTION_LABELS[action] ?? action}
                      </Button>
                    );
                  })}
                </Stack>
              </Box>
            )}

            <Divider sx={{ mb: 2, borderStyle: 'dashed' }} />

            {/* Permission list */}
            {permissionsLoading ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Cargando permisos...
              </Typography>
            ) : (
              <Stack divider={<Divider flexItem sx={{ borderStyle: 'dashed' }} />} spacing={2}>
                {Object.entries(grouped).map(([resource, perms]) => {
                  const allSelected = perms.every((p) => selectedIds.includes(p.id));
                  const someSelected = perms.some((p) => selectedIds.includes(p.id));

                  return (
                    <Box key={resource}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Checkbox
                          size="small"
                          checked={allSelected}
                          indeterminate={someSelected && !allSelected}
                          onChange={(e) => handleToggleAll(perms, e.target.checked)}
                        />
                        <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                          {resource}
                        </Typography>
                      </Box>

                      <Box sx={{ pl: 4, gap: 1, display: 'flex', flexWrap: 'wrap' }}>
                        <Controller
                          name="permission_ids"
                          control={control}
                          render={({ field }) =>
                            perms.map((perm) => {
                              const action = perm.name.split('.').slice(1).join('.');
                              return (
                                <FormControlLabel
                                  key={perm.id}
                                  label={ACTION_LABELS[action] ?? action}
                                  sx={{ mr: 2, '& .MuiFormControlLabel-label': { fontSize: 13 } }}
                                  control={
                                    <Checkbox
                                      size="small"
                                      checked={field.value.includes(perm.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          field.onChange([...field.value, perm.id]);
                                        } else {
                                          field.onChange(
                                            field.value.filter((id) => id !== perm.id)
                                          );
                                        }
                                      }}
                                    />
                                  }
                                />
                              );
                            })
                          }
                        />
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Card>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
              {isEdit ? 'Guardar cambios' : 'Crear rol'}
            </LoadingButton>
          </Box>
        </Stack>
      </form>
    </FormProvider>
  );
}
