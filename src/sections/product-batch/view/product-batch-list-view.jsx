import { useBoolean } from 'minimal-shared/hooks';
import { useRef, useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import { Toolbar, DataGrid, gridClasses } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDate } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

import { DashboardContent } from 'src/layouts/dashboard';
import { deleteProductBatch, useGetProductBatches } from 'src/actions/product-batch';

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

import { useAllProducts } from '../use-all-products';

// ----------------------------------------------------------------------

function expiryStatus(dateStr) {
  if (!dateStr) return { label: '—', color: 'default' };
  const today = new Date();
  const expiry = new Date(dateStr);
  const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: 'Vencido', color: 'error' };
  if (diffDays <= 30) return { label: `${diffDays}d`, color: 'warning' };
  if (diffDays <= 90) return { label: fDate(dateStr), color: 'info' };
  return { label: fDate(dateStr), color: 'success' };
}

// ----------------------------------------------------------------------

export function ProductBatchListView() {
  const theme = useTheme();
  const confirmDialog = useBoolean();
  const toolbarOptions = useToolbarSettings();

  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [rowToDelete, setRowToDelete] = useState(null);
  const [selectedRows, setSelectedRows] = useState({ type: 'include', ids: new Set() });

  const { batches, batchesTotal, batchesLoading, batchesMutate } = useGetProductBatches({
    page: paginationModel.page + 1,
    pageSize: paginationModel.pageSize,
  });

  const products = useAllProducts();
  const productMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p.title])),
    [products]
  );

  const rowCountRef = useRef(batchesTotal);
  if (batchesTotal > 0) rowCountRef.current = batchesTotal;

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
        await deleteProductBatch(rowToDelete);
      } else {
        await Promise.all([...selectedRows.ids].map((id) => deleteProductBatch(id)));
      }
      await batchesMutate();
      toast.success('Eliminado correctamente');
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setRowToDelete(null);
      confirmDialog.onFalse();
    }
  }, [rowToDelete, selectedRows.ids, batchesMutate, confirmDialog]);

  const deleteCount = rowToDelete ? 1 : selectedRows.ids?.size ?? 0;

  const columns = useMemo(
    () => [
      {
        field: 'product_id',
        headerName: 'Producto',
        flex: 1,
        minWidth: 220,
        hideable: false,
        valueGetter: (value) => productMap[value] ?? `ID ${value}`,
      },
      { field: 'lot_code', headerName: 'Lote', width: 140, valueGetter: (v) => v ?? '—' },
      { field: 'quantity', headerName: 'Cantidad', width: 100, type: 'number' },
      {
        field: 'expiration_date',
        headerName: 'Vencimiento',
        width: 160,
        renderCell: (params) => {
          const status = expiryStatus(params.row.expiration_date);
          return (
            <Label variant="soft" color={status.color}>
              {status.label}
            </Label>
          );
        },
      },
      {
        field: 'purchase_price',
        headerName: 'P. Compra',
        width: 120,
        valueGetter: (value) => (value != null ? fCurrency(value) : '—'),
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
            href={paths.dashboard.productBatch.edit(params.row.id)}
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
    [handleDeleteRow, productMap, theme.vars.palette.error.main]
  );

  return (
    <>
      <DashboardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <CustomBreadcrumbs
          heading="Lotes de productos"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Lotes' },
          ]}
          action={
            <Button
              component={RouterLink}
              href={paths.dashboard.productBatch.new}
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Nuevo lote
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        {/* Legend */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          {[
            { color: 'error', label: 'Vencido' },
            { color: 'warning', label: 'Vence en ≤30 días' },
            { color: 'info', label: 'Vence en ≤90 días' },
            { color: 'success', label: 'Vigente' },
          ].map((item) => (
            <Label key={item.color} variant="soft" color={item.color}>
              {item.label}
            </Label>
          ))}
        </Box>

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
            rows={batches}
            columns={columns}
            loading={batchesLoading}
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
            {deleteCount === 1 ? 'lote' : 'lotes'}?
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
