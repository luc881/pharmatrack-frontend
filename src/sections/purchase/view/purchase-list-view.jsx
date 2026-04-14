import { useBoolean } from 'minimal-shared/hooks';
import { useRef, useMemo, useState, useCallback } from 'react';

import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import { Toolbar, DataGrid, gridClasses } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDate } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

import { useGetSuppliers } from 'src/actions/supplier';
import { DashboardContent } from 'src/layouts/dashboard';
import { deletePurchase, useGetPurchases } from 'src/actions/purchase';

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

export function PurchaseListView() {
  const theme = useTheme();
  const confirmDialog = useBoolean();
  const toolbarOptions = useToolbarSettings();

  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [rowToDelete, setRowToDelete] = useState(null);
  const [selectedRows, setSelectedRows] = useState({ type: 'include', ids: new Set() });

  const { purchases, purchasesTotal, purchasesLoading, purchasesMutate } = useGetPurchases({
    page: paginationModel.page + 1,
    pageSize: paginationModel.pageSize,
  });

  const { suppliers } = useGetSuppliers({ pageSize: 100 });
  const supplierMap = useMemo(
    () => Object.fromEntries(suppliers.map((s) => [s.id, s.name])),
    [suppliers]
  );

  const rowCountRef = useRef(purchasesTotal);
  if (purchasesTotal > 0) rowCountRef.current = purchasesTotal;

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
        await deletePurchase(rowToDelete);
      } else {
        await Promise.all([...selectedRows.ids].map((id) => deletePurchase(id)));
      }
      await purchasesMutate();
      toast.success('Eliminado correctamente');
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setRowToDelete(null);
      confirmDialog.onFalse();
    }
  }, [rowToDelete, selectedRows.ids, purchasesMutate, confirmDialog]);

  const deleteCount = rowToDelete ? 1 : selectedRows.ids?.size ?? 0;

  const columns = useMemo(
    () => [
      { field: 'id', headerName: '# Compra', width: 100 },
      {
        field: 'supplier_id',
        headerName: 'Proveedor',
        flex: 1,
        minWidth: 200,
        valueGetter: (value) => supplierMap[value] ?? `ID ${value}`,
      },
      {
        field: 'date_emision',
        headerName: 'Fecha',
        width: 140,
        valueGetter: (value) => (value ? fDate(value) : '—'),
      },
      {
        field: 'total',
        headerName: 'Total',
        width: 130,
        valueGetter: (value) => fCurrency(value),
      },
      {
        field: 'description',
        headerName: 'Observaciones',
        flex: 1,
        minWidth: 180,
        valueGetter: (value) => value ?? '—',
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
            label="Ver detalle"
            icon={<Iconify icon="solar:eye-bold" />}
            href={paths.dashboard.purchase.details(params.row.id)}
          />,
          <CustomGridActionsCellItem
            showInMenu
            label="Editar"
            icon={<Iconify icon="solar:pen-bold" />}
            href={paths.dashboard.purchase.edit(params.row.id)}
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
    [handleDeleteRow, supplierMap, theme.vars.palette.error.main]
  );

  return (
    <>
      <DashboardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <CustomBreadcrumbs
          heading="Compras"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Compras' },
          ]}
          action={
            <Button
              component={RouterLink}
              href={paths.dashboard.purchase.new}
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Nueva compra
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
            rows={purchases}
            columns={columns}
            loading={purchasesLoading}
            rowCount={rowCountRef.current}
            paginationMode="server"
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
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
            {deleteCount === 1 ? 'compra' : 'compras'}?
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
