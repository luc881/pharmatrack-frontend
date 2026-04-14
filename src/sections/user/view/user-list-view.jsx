import { useBoolean } from 'minimal-shared/hooks';
import { useRef, useMemo, useState, useCallback } from 'react';

import Card from '@mui/material/Card';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import { Toolbar, DataGrid, gridClasses } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useGetRoles } from 'src/actions/role';
import { DashboardContent } from 'src/layouts/dashboard';
import { deleteUser, useGetUsers } from 'src/actions/user';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import {
  ToolbarContainer,
  ToolbarLeftPanel,
  ToolbarRightPanel,
  useToolbarSettings,
  CustomToolbarQuickFilter,
  CustomGridActionsCellItem,
  CustomToolbarExportButton,
  CustomToolbarColumnsButton,
  CustomToolbarSettingsButton,
} from 'src/components/custom-data-grid';

// ----------------------------------------------------------------------

export function UserListView() {
  const theme = useTheme();
  const confirmDialog = useBoolean();
  const toolbarOptions = useToolbarSettings();

  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [rowToDelete, setRowToDelete] = useState(null);
  const [selectedRows, setSelectedRows] = useState({ type: 'include', ids: new Set() });

  const { users, usersTotal, usersLoading, usersMutate } = useGetUsers({
    page: paginationModel.page + 1,
    pageSize: paginationModel.pageSize,
  });

  const { roles } = useGetRoles();
  const roleMap = useMemo(
    () => Object.fromEntries(
      roles.map((r) => [r.id, r.name.charAt(0).toUpperCase() + r.name.slice(1)])
    ),
    [roles]
  );

  const rowCountRef = useRef(usersTotal);
  if (usersTotal > 0) rowCountRef.current = usersTotal;

  const handleDeleteRow = useCallback(
    (id) => {
      setRowToDelete(id);
      confirmDialog.onTrue();
    },
    [confirmDialog]
  );

  const handleConfirmDelete = useCallback(async () => {
    try {
      if (rowToDelete) {
        await deleteUser(rowToDelete);
      } else {
        await Promise.all([...selectedRows.ids].map((id) => deleteUser(id)));
      }
      await usersMutate();
      toast.success('Eliminado correctamente');
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setRowToDelete(null);
      confirmDialog.onFalse();
    }
  }, [rowToDelete, selectedRows.ids, usersMutate, confirmDialog]);

  const deleteCount = rowToDelete ? 1 : selectedRows.ids?.size ?? 0;

  const columns = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Usuario',
        flex: 1,
        minWidth: 220,
        hideable: false,
        renderCell: (params) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            <Avatar
              src={params.row.avatar || ''}
              sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}
            >
              {params.row.name?.[0]?.toUpperCase()}
            </Avatar>
            <div>
              <div style={{ fontWeight: 500 }}>
                {params.row.name} {params.row.surname ?? ''}
              </div>
              <div style={{ fontSize: 12, color: theme.vars.palette.text.secondary }}>
                {params.row.email}
              </div>
            </div>
          </div>
        ),
      },
      {
        field: 'role_id',
        headerName: 'Rol',
        width: 140,
        renderCell: (params) =>
          params.row.role_id ? (
            <Label variant="soft" color="primary">
              {roleMap[params.row.role_id] ?? `ID ${params.row.role_id}`}
            </Label>
          ) : (
            '—'
          ),
      },
      { field: 'phone', headerName: 'Teléfono', width: 150, valueGetter: (v) => v ?? '—' },
      {
        type: 'actions',
        field: 'actions',
        headerName: ' ',
        width: 64,
        align: 'right',
        headerAlign: 'right',
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        getActions: (params) => [
          <CustomGridActionsCellItem
            showInMenu
            label="Editar"
            icon={<Iconify icon="solar:pen-bold" />}
            href={paths.dashboard.user.edit(params.row.id)}
          />,
          <CustomGridActionsCellItem
            showInMenu
            label="Eliminar"
            icon={<Iconify icon="solar:trash-bin-trash-bold" />}
            onClick={() => handleDeleteRow(params.row.id)}
            style={{ color: theme.vars.palette.error.main }}
          />,
        ],
      },
    ],
    [handleDeleteRow, roleMap, theme.vars.palette.error.main, theme.vars.palette.text.secondary]
  );

  return (
    <>
      <DashboardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <CustomBreadcrumbs
          heading="Usuarios"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Usuarios' },
          ]}
          action={
            <Button
              component={RouterLink}
              href={paths.dashboard.user.new}
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Nuevo usuario
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card
          sx={{
            minHeight: 480,
            flexGrow: { md: 1 },
            display: { md: 'flex' },
            height: { xs: 640, md: '1px' },
            flexDirection: { md: 'column' },
          }}
        >
          <DataGrid
            {...toolbarOptions.settings}
            checkboxSelection
            disableRowSelectionOnClick
            rows={users}
            columns={columns}
            loading={usersLoading}
            rowCount={rowCountRef.current}
            paginationMode="server"
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            getRowHeight={() => 'auto'}
            pageSizeOptions={[10, 25, 50]}
            onRowSelectionModelChange={(m) => setSelectedRows(m)}
            slots={{
              noRowsOverlay: () => <EmptyContent />,
              noResultsOverlay: () => <EmptyContent title="Sin resultados" />,
              toolbar: () => (
                <Toolbar>
                  <ToolbarContainer>
                    <ToolbarLeftPanel>
                      <CustomToolbarQuickFilter />
                    </ToolbarLeftPanel>
                    <ToolbarRightPanel>
                      {!!(selectedRows.ids?.size > 0) && (
                        <Button
                          size="small"
                          color="error"
                          startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
                          onClick={() => {
                            setRowToDelete(null);
                            confirmDialog.onTrue();
                          }}
                        >
                          Eliminar ({selectedRows.ids.size})
                        </Button>
                      )}
                      <CustomToolbarColumnsButton />
                      <CustomToolbarExportButton />
                      <CustomToolbarSettingsButton
                        settings={toolbarOptions.settings}
                        onChangeSettings={toolbarOptions.onChangeSettings}
                      />
                    </ToolbarRightPanel>
                  </ToolbarContainer>
                </Toolbar>
              ),
            }}
            sx={{ [`& .${gridClasses.cell}`]: { display: 'flex', alignItems: 'center' } }}
          />
        </Card>
      </DashboardContent>

      <ConfirmDialog
        open={confirmDialog.value}
        onClose={confirmDialog.onFalse}
        title="Eliminar"
        content={
          <>
            ¿Estás seguro de eliminar <strong>{deleteCount}</strong>{' '}
            {deleteCount === 1 ? 'usuario' : 'usuarios'}?
          </>
        }
        action={
          <Button variant="contained" color="error" onClick={handleConfirmDelete}>
            Eliminar
          </Button>
        }
      />
    </>
  );
}
