import { useSearchParams } from 'react-router';
import { useBoolean } from 'minimal-shared/hooks';
import { useRef, useMemo, useState, useCallback } from 'react';

import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import { DataGrid, gridClasses } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { DashboardContent } from 'src/layouts/dashboard';
import { deleteProduct, useGetProducts, useGetProductBrands, useGetProductCategories } from 'src/actions/product';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { useToolbarSettings, CustomGridActionsCellItem } from 'src/components/custom-data-grid';

import { ProductTableToolbar } from '../product-table-toolbar';
import {
  RenderCellPrice,
  RenderCellStatus,
  RenderCellProduct,
  RenderCellPriceCost,
  RenderCellCreatedAt,
} from '../product-table-row';

// ----------------------------------------------------------------------

const HIDE_COLUMNS = { price_cost: false, created_at: false };
const HIDE_COLUMNS_TOGGLABLE = ['actions'];

// ----------------------------------------------------------------------

export function ProductListView() {
  const confirmDialog = useBoolean();
  const toolbarOptions = useToolbarSettings();

  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [selectedRows, setSelectedRows] = useState({ type: 'include', ids: new Set() });
  const [columnVisibilityModel, setColumnVisibilityModel] = useState(HIDE_COLUMNS);
  const [rowToDelete, setRowToDelete] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const appliedSearch = searchParams.get('search') ?? '';

  const handleSearchSubmit = useCallback((value) => {
    setSearchParams(value ? { search: value } : {}, { replace: true });
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, [setSearchParams]);

  const { brands } = useGetProductBrands();
  const brandsMap = useMemo(() => Object.fromEntries(brands.map((b) => [b.id, b.name])), [brands]);

  const { categories } = useGetProductCategories();
  const categoriesMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  const { products, productsTotal, productsLoading, productsMutate } = useGetProducts({
    page: paginationModel.page + 1,
    pageSize: paginationModel.pageSize,
    search: appliedSearch,
  });

  // Evita que el DataGrid resetee la paginación cuando rowCount cae a 0 durante el fetch
  const rowCountRef = useRef(productsTotal);
  if (productsTotal > 0) rowCountRef.current = productsTotal;
  const stableRowCount = rowCountRef.current;

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
        await deleteProduct(rowToDelete);
      } else {
        await Promise.all([...selectedRows.ids].map((id) => deleteProduct(id)));
      }
      await productsMutate();
      toast.success('Eliminado correctamente');
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setRowToDelete(null);
      confirmDialog.onFalse();
    }
  }, [rowToDelete, selectedRows.ids, productsMutate, confirmDialog]);

  const columns = useGetColumns({ onDeleteRow: handleDeleteRow, brandsMap, categoriesMap });

  const deleteCount = rowToDelete ? 1 : selectedRows.ids.size;

  return (
    <>
      <DashboardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <CustomBreadcrumbs
          heading="Productos"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Productos', href: paths.dashboard.product.root },
            { name: 'Lista' },
          ]}
          action={
            <Button
              component={RouterLink}
              href={paths.dashboard.product.new}
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Nuevo producto
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card
          sx={{
            minHeight: 640,
            flexGrow: { md: 1 },
            display: { md: 'flex' },
            height: { xs: 800, md: '1px' },
            flexDirection: { md: 'column' },
          }}
        >
          <DataGrid
            {...toolbarOptions.settings}
            checkboxSelection
            disableRowSelectionOnClick
            rows={products}
            columns={columns}
            loading={productsLoading}
            rowHeight={72}
            rowBufferPx={4000}
            // Paginación server-side
            paginationMode="server"
            rowCount={stableRowCount}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[10, 20, 50]}
            columnVisibilityModel={columnVisibilityModel}
            onColumnVisibilityModelChange={setColumnVisibilityModel}
            onRowSelectionModelChange={(newSelectionModel) => setSelectedRows(newSelectionModel)}
            slots={{
              noRowsOverlay: () => <EmptyContent />,
              noResultsOverlay: () => <EmptyContent title="Sin resultados" />,
              toolbar: ProductTableToolbar,
            }}
            slotProps={{
              toolbar: {
                initialSearch: appliedSearch,
                onSearchSubmit: handleSearchSubmit,
                selectedRowCount: selectedRows.ids?.size ?? 0,
                onOpenConfirmDeleteRows: () => {
                  setRowToDelete(null);
                  confirmDialog.onTrue();
                },
                settings: toolbarOptions.settings,
                onChangeSettings: toolbarOptions.onChangeSettings,
              },
              columnsManagement: {
                getTogglableColumns: () =>
                  columns
                    .filter((col) => !HIDE_COLUMNS_TOGGLABLE.includes(col.field))
                    .map((col) => col.field),
              },
            }}
            sx={{
              [`& .${gridClasses.cell}`]: {
                display: 'flex',
                alignItems: 'center',
              },
            }}
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
            {deleteCount === 1 ? 'producto' : 'productos'}?
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

// ----------------------------------------------------------------------

const useGetColumns = ({ onDeleteRow, brandsMap, categoriesMap }) => {
  const theme = useTheme();

  return useMemo(
    () => [
      {
        field: 'title',
        headerName: 'Producto',
        flex: 1,
        minWidth: 320,
        hideable: false,
        renderCell: (params) => (
          <RenderCellProduct
            params={params}
            href={paths.dashboard.product.details(params.row.id)}
            categoryName={categoriesMap[params.row.product_category_id]}
          />
        ),
      },
      {
        field: 'sku',
        headerName: 'SKU',
        width: 150,
      },
      {
        field: 'brand',
        headerName: 'Marca',
        width: 140,
        valueGetter: (_, row) => brandsMap[row.brand_id] ?? '—',
      },
      {
        field: 'price_retail',
        headerName: 'P. Venta',
        width: 110,
        renderCell: (params) => <RenderCellPrice params={params} />,
      },
      {
        field: 'price_cost',
        headerName: 'P. Costo',
        width: 110,
        renderCell: (params) => <RenderCellPriceCost params={params} />,
      },
      {
        field: 'is_active',
        headerName: 'Estado',
        width: 110,
        renderCell: (params) => <RenderCellStatus params={params} />,
      },
      {
        field: 'created_at',
        headerName: 'Creado',
        width: 120,
        renderCell: (params) => <RenderCellCreatedAt params={params} />,
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
            label="Ver"
            icon={<Iconify icon="solar:eye-bold" />}
            href={paths.dashboard.product.details(params.row.id)}
          />,
          <CustomGridActionsCellItem
            showInMenu
            label="Editar"
            icon={<Iconify icon="solar:pen-bold" />}
            href={paths.dashboard.product.edit(params.row.id)}
          />,
          <CustomGridActionsCellItem
            showInMenu
            label="Eliminar"
            icon={<Iconify icon="solar:trash-bin-trash-bold" />}
            onClick={() => onDeleteRow(params.row.id)}
            style={{ color: theme.vars.palette.error.main }}
          />,
        ],
      },
    ],
    [onDeleteRow, brandsMap, categoriesMap, theme.vars.palette.error.main]
  );
};
