import { z as zod } from 'zod';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import TableContainer from '@mui/material/TableContainer';
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

// Recursos de administración del sistema (solo super administrador y dueño pueden tocarlos)
const SYSTEM_RESOURCES = ['users', 'roles', 'permissions'];

// Recursos de ventas con operaciones completas
const SALES_RESOURCES = [
  'sales', 'saledetails', 'salepayments', 'salebatchusages',
  'saledetailattentions', 'refundproducts', 'clients',
];

// Recursos de venta que el cajero/farmacéutico solo puede leer
const SALES_LOOKUP_RESOURCES = ['products', 'productbatches', 'branches'];

// Recursos de inventario y catálogos
const INVENTORY_RESOURCES = [
  'products', 'productbatches', 'productbrands', 'productmasters',
  'productscategories', 'productstockinitials', 'productwallets',
  'productwarehouses', 'ingredients', 'units', 'conversions',
];

// Recursos de compras y proveedores
const PURCHASE_RESOURCES = ['suppliers', 'purchases', 'purchasedetails'];

// Recursos de logística y ubicaciones
const LOGISTICS_RESOURCES = ['warehouses', 'transports', 'branches'];

const TEMPLATES = [
  // Sin acceso — usuario creado pero sin permisos asignados aún
  {
    label: 'Sin acceso',
    color: 'default',
    filter: () => false,
  },

  // Solo lectura — auditores, contadores, supervisores externos
  {
    label: 'Solo lectura',
    color: 'info',
    filter: (p) => p.name.endsWith('.read'),
  },

  // Cajero — procesa ventas nuevas, no puede cancelar ni hacer devoluciones
  {
    label: 'Cajero',
    color: 'default',
    filter: (p) => {
      const [resource, action] = p.name.split('.');
      // Ventas: solo crear y leer (sin eliminar ni devoluciones)
      if (['sales', 'saledetails', 'salepayments', 'salebatchusages'].includes(resource))
        return action === 'create' || action === 'read';
      // Clientes: puede crear nuevos y consultar existentes
      if (resource === 'clients') return action === 'create' || action === 'read';
      // Consulta de productos, lotes y sucursal para el punto de venta
      if (SALES_LOOKUP_RESOURCES.includes(resource)) return action === 'read';
      return false;
    },
  },

  // Farmacéutico — operaciones completas de venta incluyendo devoluciones
  {
    label: 'Farmacéutico',
    color: 'warning',
    filter: (p) => {
      const [resource, action] = p.name.split('.');
      // Acceso completo a ventas, clientes y devoluciones
      if (SALES_RESOURCES.includes(resource)) return true;
      // Solo lectura en productos, lotes y sucursales (consulta en punto de venta)
      if (SALES_LOOKUP_RESOURCES.includes(resource)) return action === 'read';
      return false;
    },
  },

  // Almacenista — gestión de inventario y compras, sin acceso a ventas ni sistema
  {
    label: 'Almacenista',
    color: 'secondary',
    filter: (p) => {
      const [resource, action] = p.name.split('.');
      // Acceso completo a inventario y catálogos de productos
      if (INVENTORY_RESOURCES.includes(resource)) return true;
      // Acceso completo a compras y proveedores
      if (PURCHASE_RESOURCES.includes(resource)) return true;
      // Lectura de logística y sucursales (saber a dónde va el inventario)
      if (LOGISTICS_RESOURCES.includes(resource)) return action === 'read';
      return false;
    },
  },

  // Gerente de sucursal — operaciones completas del negocio, sin gestión de sistema
  {
    label: 'Gerente de sucursal',
    color: 'primary',
    filter: (p) => !SYSTEM_RESOURCES.includes(p.name.split('.')[0]),
  },

  // Dueño — todo el negocio + gestión de usuarios; solo lectura en roles y permisos
  {
    label: 'Dueño',
    color: 'success',
    filter: (p) => {
      const [resource, action] = p.name.split('.');
      // Puede leer roles y permisos para entender la configuración, pero no modificarlos
      if (resource === 'roles' || resource === 'permissions') return action === 'read';
      // Acceso total a todo lo demás, incluyendo gestión de usuarios
      return true;
    },
  },

  // Super administrador — acceso total, solo para el administrador del sistema
  {
    label: 'Super administrador',
    color: 'error',
    filter: () => true,
  },
];

const ACTION_LABELS = { read: 'Leer', create: 'Crear', update: 'Actualizar', delete: 'Eliminar' };

// ----------------------------------------------------------------------

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

  const { watch, setValue, handleSubmit, formState: { isSubmitting } } = methods;

  const selectedIds = watch('permission_ids');
  const grouped = groupPermissions(permissions);

  const allActions = useMemo(() => {
    const actions = new Set();
    permissions.forEach((p) => {
      const parts = p.name.split('.');
      if (parts.length > 1) actions.add(parts.slice(1).join('.'));
    });
    return [...actions].sort();
  }, [permissions]);

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

  const applyTemplate = (filter, label) => {
    setValue('permission_ids', permissions.filter(filter).map((p) => p.id));
    if (!isEdit) setValue('name', label);
  };

  const handleToggleAll = (resourcePerms, checked) => {
    const ids = resourcePerms.map((p) => p.id);
    if (checked) {
      setValue('permission_ids', [...new Set([...selectedIds, ...ids])]);
    } else {
      setValue('permission_ids', selectedIds.filter((id) => !ids.includes(id)));
    }
  };

  const handleTogglePerm = (permId, checked) => {
    if (checked) {
      setValue('permission_ids', [...selectedIds, permId]);
    } else {
      setValue('permission_ids', selectedIds.filter((id) => id !== permId));
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
            <Box sx={{ mb: 2.5 }}>
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
                    onClick={() => applyTemplate(tpl.filter, tpl.label)}
                  />
                ))}
              </Stack>
            </Box>

            {/* Permission table */}
            {permissionsLoading ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Cargando permisos...
              </Typography>
            ) : (
              <TableContainer
                sx={{
                  maxHeight: 460,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 180, fontWeight: 600, bgcolor: 'background.neutral' }}>
                        Recurso
                      </TableCell>
                      {allActions.map((action) => {
                        const selected = isActionFullySelected(action);
                        return (
                          <TableCell
                            key={action}
                            align="center"
                            sx={{ minWidth: 110, bgcolor: 'background.neutral' }}
                          >
                            <Button
                              size="small"
                              variant={selected ? 'contained' : 'outlined'}
                              color="inherit"
                              onClick={() => handleToggleAction(action)}
                              sx={{ fontSize: 11, minWidth: 90 }}
                            >
                              {ACTION_LABELS[action] ?? action}
                            </Button>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {Object.entries(grouped).map(([resource, perms]) => {
                      const allSelected = perms.every((p) => selectedIds.includes(p.id));
                      const someSelected = perms.some((p) => selectedIds.includes(p.id));

                      return (
                        <TableRow key={resource} hover>
                          <TableCell>
                            <FormControlLabel
                              label={resource}
                              sx={{
                                m: 0,
                                '& .MuiFormControlLabel-label': {
                                  fontSize: 13,
                                  textTransform: 'capitalize',
                                },
                              }}
                              control={
                                <Checkbox
                                  size="small"
                                  checked={allSelected}
                                  indeterminate={someSelected && !allSelected}
                                  onChange={(e) => handleToggleAll(perms, e.target.checked)}
                                />
                              }
                            />
                          </TableCell>
                          {allActions.map((action) => {
                            const perm = perms.find((p) => p.name.endsWith(`.${action}`));
                            if (!perm) {
                              return <TableCell key={action} align="center">—</TableCell>;
                            }
                            return (
                              <TableCell key={action} align="center">
                                <Checkbox
                                  size="small"
                                  checked={selectedIds.includes(perm.id)}
                                  onChange={(e) => handleTogglePerm(perm.id, e.target.checked)}
                                />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
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
