import { useBoolean } from 'minimal-shared/hooks';
import { useMemo, useState, useCallback } from 'react';

import Card from '@mui/material/Card';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import { Toolbar, DataGrid, gridClasses } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { DashboardContent } from 'src/layouts/dashboard';
import { deleteProductBrand, useGetAllProductBrands } from 'src/actions/product-brand';

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
  CustomToolbarColumnsButton,
  CustomToolbarSettingsButton,
} from 'src/components/custom-data-grid';

// ----------------------------------------------------------------------

export function ProductBrandListView() {
  const theme = useTheme();
  const confirmDialog = useBoolean();
  const toolbarOptions = useToolbarSettings();

  const [rowToDelete, setRowToDelete] = useState(null);
  const [selectedRows, setSelectedRows] = useState({ type: 'include', ids: new Set() });

  const { brands, brandsLoading, brandsMutate } = useGetAllProductBrands();

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
        await deleteProductBrand(rowToDelete);
      } else {
        await Promise.all([...selectedRows.ids].map((id) => deleteProductBrand(id)));
      }
      await brandsMutate();
      toast.success('Eliminado correctamente');
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setRowToDelete(null);
      confirmDialog.onFalse();
    }
  }, [rowToDelete, selectedRows.ids, brandsMutate, confirmDialog]);

  const deleteCount = rowToDelete ? 1 : selectedRows.ids?.size ?? 0;

  const columns = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Marca',
        flex: 1,
        minWidth: 200,
        hideable: false,
        renderCell: (params) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            <Avatar
              src={params.row.logo || ''}
              variant="rounded"
              sx={{ width: 36, height: 36, bgcolor: 'background.neutral' }}
            >
              {params.row.name?.[0]}
            </Avatar>
            <span>{params.row.name}</span>
          </div>
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
            href={paths.dashboard.productBrand.edit(params.row.id)}
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
          heading="Marcas"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Marcas' },
          ]}
          action={
            <Button
              component={RouterLink}
              href={paths.dashboard.productBrand.new}
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Nueva marca
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
            rows={brands}
            columns={columns}
            loading={brandsLoading}
            getRowHeight={() => 'auto'}
            pageSizeOptions={[25, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
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
            {deleteCount === 1 ? 'marca' : 'marcas'}?
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
