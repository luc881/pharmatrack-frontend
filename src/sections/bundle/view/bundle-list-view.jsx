import { useState, useCallback } from 'react';

import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import { DataGrid, gridClasses } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';

import { DashboardContent } from 'src/layouts/dashboard';
import { deleteProduct, useGetProducts } from 'src/actions/product';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { CustomGridActionsCellItem } from 'src/components/custom-data-grid';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

export function BundleListView() {
  const theme = useTheme();
  const { user } = useAuthContext();
  const can = (action) => user?.permissions?.includes(`products.${action}`);

  const [rowToDelete, setRowToDelete] = useState(null);

  const { products, productsLoading, productsMutate } = useGetProducts({
    onlyBundles: true,
    pageSize: 100,
  });

  const handleConfirmDelete = useCallback(async () => {
    try {
      await deleteProduct(rowToDelete.id);
      await productsMutate();
      toast.success('Paquete eliminado');
    } catch (error) {
      toast.error(error.message || 'Error al eliminar');
    } finally {
      setRowToDelete(null);
    }
  }, [rowToDelete, productsMutate]);

  const columns = [
    { field: 'title', headerName: 'Paquete', flex: 1, minWidth: 240 },
    { field: 'sku', headerName: 'Código', width: 150, valueGetter: (v) => v ?? '—' },
    { field: 'price_retail', headerName: 'Precio', width: 110, valueGetter: (v) => fCurrency(v) },
    {
      field: 'compare_at_price',
      headerName: 'Antes',
      width: 110,
      valueGetter: (v) => (v ? fCurrency(v) : '—'),
    },
    {
      field: 'show_online',
      headerName: 'En tienda',
      width: 110,
      renderCell: (params) =>
        params.row.show_online ? (
          <Label variant="soft" color="success">Visible</Label>
        ) : (
          <Label variant="soft" color="default">Oculto</Label>
        ),
    },
    {
      type: 'actions',
      field: 'actions',
      headerName: ' ',
      width: 96,
      align: 'right',
      headerAlign: 'right',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      getActions: (params) => [
        ...(can('update')
          ? [
              <CustomGridActionsCellItem
                label="Editar"
                icon={<Iconify icon="solar:pen-bold" />}
                href={paths.dashboard.bundle.edit(params.row.id)}
              />,
            ]
          : []),
        ...(can('delete')
          ? [
              <CustomGridActionsCellItem
                label="Eliminar"
                icon={<Iconify icon="solar:trash-bin-trash-bold" sx={{ color: theme.vars.palette.error.main }} />}
                onClick={() => setRowToDelete(params.row)}
              />,
            ]
          : []),
      ],
    },
  ];

  return (
    <>
      <DashboardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <CustomBreadcrumbs
          heading="Paquetes"
          links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Paquetes' }]}
          action={
            can('create') && (
              <Button
                component={RouterLink}
                href={paths.dashboard.bundle.new}
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
              >
                Nuevo paquete
              </Button>
            )
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
            disableRowSelectionOnClick
            rows={products}
            columns={columns}
            loading={productsLoading}
            pageSizeOptions={[25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            slots={{
              noRowsOverlay: () => (
                <EmptyContent
                  title="Sin paquetes"
                  description="Combina productos y animales con precio de paquete"
                />
              ),
              noResultsOverlay: () => <EmptyContent title="Sin resultados" />,
            }}
            sx={{ [`& .${gridClasses.cell}`]: { display: 'flex', alignItems: 'center' } }}
          />
        </Card>
      </DashboardContent>

      <ConfirmDialog
        open={!!rowToDelete}
        onClose={() => setRowToDelete(null)}
        title="Eliminar"
        content={
          <>
            ¿Eliminar el paquete <strong>{rowToDelete?.title}</strong>? Los componentes no se
            tocan, solo desaparece el paquete.
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
