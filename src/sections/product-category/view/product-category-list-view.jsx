import { useBoolean } from 'minimal-shared/hooks';
import { useMemo, useState, useCallback } from 'react';

import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import { Toolbar, DataGrid, gridClasses } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { DashboardContent } from 'src/layouts/dashboard';
import { deleteProductCategory, useGetAllProductCategories } from 'src/actions/product-category';

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
  CustomToolbarColumnsButton,
  CustomToolbarSettingsButton,
} from 'src/components/custom-data-grid';

// ----------------------------------------------------------------------

export function ProductCategoryListView() {
  const theme = useTheme();
  const confirmDialog = useBoolean();
  const toolbarOptions = useToolbarSettings();

  const [rowToDelete, setRowToDelete] = useState(null);
  const [selectedRows, setSelectedRows] = useState({ type: 'include', ids: new Set() });

  const { categories, categoriesLoading, categoriesMutate } = useGetAllProductCategories();

  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories]
  );

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
        await deleteProductCategory(rowToDelete);
      } else {
        await Promise.all([...selectedRows.ids].map((id) => deleteProductCategory(id)));
      }
      await categoriesMutate();
      toast.success('Eliminado correctamente');
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setRowToDelete(null);
      confirmDialog.onFalse();
    }
  }, [rowToDelete, selectedRows.ids, categoriesMutate, confirmDialog]);

  const deleteCount = rowToDelete ? 1 : selectedRows.ids?.size ?? 0;

  const columns = useMemo(
    () => [
      { field: 'name', headerName: 'Nombre', flex: 1, minWidth: 200, hideable: false },
      {
        field: 'parent_id',
        headerName: 'Categoría padre',
        width: 200,
        valueGetter: (value) => (value ? categoryMap[value] ?? `ID ${value}` : '—'),
      },
      {
        field: 'is_active',
        headerName: 'Estado',
        width: 110,
        renderCell: (params) => (
          <Label variant="soft" color={params.row.is_active ? 'success' : 'default'}>
            {params.row.is_active ? 'Activa' : 'Inactiva'}
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
            href={paths.dashboard.productCategory.edit(params.row.id)}
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
    [categoryMap, handleDeleteRow, theme.vars.palette.error.main]
  );

  return (
    <>
      <DashboardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <CustomBreadcrumbs
          heading="Categorías"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Categorías' },
          ]}
          action={
            <Button
              component={RouterLink}
              href={paths.dashboard.productCategory.new}
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Nueva categoría
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
            rows={categories}
            columns={columns}
            loading={categoriesLoading}
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
            {deleteCount === 1 ? 'categoría' : 'categorías'}?
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
