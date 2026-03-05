import { useBoolean } from 'minimal-shared/hooks';
import { useMemo, useState, useCallback } from 'react';

import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import { useTheme } from '@mui/material/styles';
import { DataGrid, gridClasses, Toolbar } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { DashboardContent } from 'src/layouts/dashboard';
import { deleteSupplier, useGetSuppliers } from 'src/actions/supplier';

import { toast } from 'src/components/snackbar';
import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import {
  useToolbarSettings,
  ToolbarContainer,
  ToolbarLeftPanel,
  ToolbarRightPanel,
  CustomGridActionsCellItem,
  CustomToolbarQuickFilter,
  CustomToolbarExportButton,
  CustomToolbarColumnsButton,
  CustomToolbarSettingsButton,
} from 'src/components/custom-data-grid';

// ----------------------------------------------------------------------

export function SupplierListView() {
  const theme = useTheme();
  const confirmDialog = useBoolean();
  const toolbarOptions = useToolbarSettings();

  const [rowToDelete, setRowToDelete] = useState(null);
  const [selectedRows, setSelectedRows] = useState({ type: 'include', ids: new Set() });

  const { suppliers, suppliersLoading, suppliersMutate } = useGetSuppliers();

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
        await deleteSupplier(rowToDelete);
      } else {
        await Promise.all([...selectedRows.ids].map((id) => deleteSupplier(id)));
      }
      await suppliersMutate();
      toast.success('Eliminado correctamente');
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setRowToDelete(null);
      confirmDialog.onFalse();
    }
  }, [rowToDelete, selectedRows.ids, suppliersMutate, confirmDialog]);

  const deleteCount = rowToDelete ? 1 : selectedRows.ids?.size ?? 0;

  const columns = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Proveedor',
        flex: 1,
        minWidth: 260,
        hideable: false,
        renderCell: (params) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            <Avatar
              src={params.row.logo || ''}
              alt={params.row.name}
              variant="rounded"
              sx={{ width: 40, height: 40, bgcolor: 'background.neutral' }}
            >
              {params.row.name?.[0]}
            </Avatar>
            <span>{params.row.name}</span>
          </div>
        ),
      },
      { field: 'rfc', headerName: 'RFC', width: 140 },
      { field: 'email', headerName: 'Email', width: 220 },
      { field: 'phone', headerName: 'Teléfono', width: 140 },
      {
        field: 'is_active',
        headerName: 'Estado',
        width: 110,
        renderCell: (params) => (
          <Label variant="soft" color={params.row.is_active ? 'success' : 'default'}>
            {params.row.is_active ? 'Activo' : 'Inactivo'}
          </Label>
        ),
      },
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
            href={paths.dashboard.supplier.edit(params.row.id)}
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
    [handleDeleteRow, theme.vars.palette.error.main]
  );

  return (
    <>
      <DashboardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <CustomBreadcrumbs
          heading="Proveedores"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Proveedores' },
          ]}
          action={
            <Button
              component={RouterLink}
              href={paths.dashboard.supplier.new}
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Nuevo proveedor
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
            rows={suppliers}
            columns={columns}
            loading={suppliersLoading}
            getRowHeight={() => 'auto'}
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
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
            {deleteCount === 1 ? 'proveedor' : 'proveedores'}?
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
