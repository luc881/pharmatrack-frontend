import { useState, useCallback } from 'react';

import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import { DataGrid, gridClasses } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDate } from 'src/utils/format-time';

import { DashboardContent } from 'src/layouts/dashboard';
import { deleteArticle, useGetArticles } from 'src/actions/articles';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { CustomGridActionsCellItem } from 'src/components/custom-data-grid';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

export function ArticleListView() {
  const theme = useTheme();
  const { user } = useAuthContext();

  const can = (action) => user?.permissions?.includes(`articles.${action}`);

  const [rowToDelete, setRowToDelete] = useState(null);

  const { articles, articlesLoading, articlesMutate } = useGetArticles();

  const handleConfirmDelete = useCallback(async () => {
    try {
      await deleteArticle(rowToDelete.id);
      await articlesMutate();
      toast.success('Artículo eliminado');
    } catch (error) {
      toast.error(error.message || 'Error al eliminar');
    } finally {
      setRowToDelete(null);
    }
  }, [rowToDelete, articlesMutate]);

  const columns = [
    { field: 'title', headerName: 'Título', flex: 1, minWidth: 260 },
    { field: 'category', headerName: 'Categoría', width: 140, valueGetter: (v) => v ?? '—' },
    {
      field: 'published',
      headerName: 'Estado',
      width: 160,
      renderCell: (params) =>
        params.row.published ? (
          <Label variant="soft" color="success">
            Publicado {fDate(params.row.published_at)}
          </Label>
        ) : (
          <Label variant="soft" color="default">
            Borrador
          </Label>
        ),
    },
    { field: 'reading_minutes', headerName: 'Lectura', width: 90, valueGetter: (v) => `${v} min` },
    { field: 'updated_at', headerName: 'Actualizado', width: 130, valueGetter: (v) => fDate(v) },
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
                href={paths.dashboard.article.edit(params.row.id)}
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
          heading="Artículos"
          links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Artículos' }]}
          action={
            can('create') && (
              <Button
                component={RouterLink}
                href={paths.dashboard.article.new}
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
              >
                Nuevo artículo
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
            rows={articles}
            columns={columns}
            loading={articlesLoading}
            pageSizeOptions={[25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            slots={{
              noRowsOverlay: () => <EmptyContent title="Sin artículos" description="Crea el primero con el botón de arriba" />,
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
            ¿Eliminar el artículo <strong>{rowToDelete?.title}</strong>?
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
