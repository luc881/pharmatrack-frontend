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

import { DashboardContent } from 'src/layouts/dashboard';
import { deleteSale, useGetSales } from 'src/actions/sale';

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

import { useAllProducts } from 'src/sections/product-batch/use-all-products';

import { SalePDFRowButton } from '../sale-pdf';

// ----------------------------------------------------------------------

const STATUS_COLOR = {
  completed: 'success',
  cancelled: 'error',
  refunded: 'warning',
};

const STATUS_LABEL = {
  completed: 'Completada',
  cancelled: 'Cancelada',
  refunded: 'Reembolsada',
};

// ----------------------------------------------------------------------

export function SaleListView() {
  const theme = useTheme();
  const confirmDialog = useBoolean();
  const toolbarOptions = useToolbarSettings();

  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [rowToDelete, setRowToDelete] = useState(null);
  const [selectedRows, setSelectedRows] = useState({ type: 'include', ids: new Set() });

  const products = useAllProducts();
  const productMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p.title])),
    [products]
  );

  const { sales, salesTotal, salesLoading, salesMutate } = useGetSales({
    page: paginationModel.page + 1,
    pageSize: paginationModel.pageSize,
  });

  const rowCountRef = useRef(salesTotal);
  if (salesTotal > 0) rowCountRef.current = salesTotal;

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
        await deleteSale(rowToDelete);
      } else {
        await Promise.all([...selectedRows.ids].map((id) => deleteSale(id)));
      }
      await salesMutate();
      toast.success('Eliminado correctamente');
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setRowToDelete(null);
      confirmDialog.onFalse();
    }
  }, [rowToDelete, selectedRows.ids, salesMutate, confirmDialog]);

  const deleteCount = rowToDelete ? 1 : selectedRows.ids?.size ?? 0;

  const columns = useMemo(
    () => [
      { field: 'id', headerName: '# Venta', width: 90 },
      {
        field: 'date_sale',
        headerName: 'Fecha',
        width: 140,
        valueGetter: (value) => (value ? fDate(value) : '—'),
      },
      {
        field: 'total',
        headerName: 'Total',
        width: 120,
        valueGetter: (value) => fCurrency(Number(value)),
      },
      {
        field: 'subtotal',
        headerName: 'Subtotal',
        width: 120,
        valueGetter: (value) => fCurrency(Number(value)),
      },
      {
        field: 'discount',
        headerName: 'Descuento',
        width: 110,
        valueGetter: (value) => fCurrency(Number(value)),
      },
      {
        field: 'status',
        headerName: 'Estado',
        width: 130,
        renderCell: (params) => (
          <Label variant="soft" color={STATUS_COLOR[params.row.status] ?? 'default'}>
            {STATUS_LABEL[params.row.status] ?? params.row.status}
          </Label>
        ),
      },
      {
        field: 'description',
        headerName: 'Observaciones',
        flex: 1,
        minWidth: 160,
        valueGetter: (value) => value ?? '—',
      },
      {
        field: 'pdf',
        headerName: ' ',
        width: 48,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <SalePDFRowButton sale={params.row} productMap={productMap} />
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
            label="Ver detalle"
            icon={<Iconify icon="solar:eye-bold" />}
            href={paths.dashboard.sale.details(params.row.id)}
          />,
          <CustomGridActionsCellItem
            showInMenu
            label="Editar"
            icon={<Iconify icon="solar:pen-bold" />}
            href={paths.dashboard.sale.edit(params.row.id)}
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
          heading="Ventas"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Ventas' },
          ]}
          action={
            <Button
              component={RouterLink}
              href={paths.dashboard.sale.new}
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Nueva venta
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
            rows={sales}
            columns={columns}
            loading={salesLoading}
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
            {deleteCount === 1 ? 'venta' : 'ventas'}?
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
