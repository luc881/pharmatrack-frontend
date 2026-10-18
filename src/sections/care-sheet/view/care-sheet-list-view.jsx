import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import { DataGrid, gridClasses } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDate } from 'src/utils/format-time';

import { DashboardContent } from 'src/layouts/dashboard';
import { deleteCareSheet, useGetCareSheets } from 'src/actions/care-sheets';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

// «Pandinus imperator “Ghana”»: binomio en itálica, localidad entre comillas sin itálica
export function SheetName({ sheet }) {
  return (
    <span>
      <Box component="em">{sheet.scientific_name}</Box>
      {sheet.locality && ` “${sheet.locality}”`}
    </span>
  );
}

export function CareSheetListView() {
  const { user } = useAuthContext();

  const can = (action) => user?.permissions?.includes(`species.${action}`);

  const [rowToDelete, setRowToDelete] = useState(null);

  const { careSheets, careSheetsLoading, careSheetsMutate } = useGetCareSheets();

  const handleConfirmDelete = useCallback(async () => {
    try {
      await deleteCareSheet(rowToDelete.id);
      await careSheetsMutate();
      toast.success('Ficha eliminada');
    } catch (error) {
      toast.error(error.message || 'Error al eliminar');
    } finally {
      setRowToDelete(null);
    }
  }, [rowToDelete, careSheetsMutate]);

  const columns = [
    {
      field: 'scientific_name',
      headerName: 'Especie',
      flex: 1,
      minWidth: 240,
      renderCell: (params) => <SheetName sheet={params.row} />,
    },
    { field: 'common_name', headerName: 'Nombre común', width: 180, valueGetter: (v) => v ?? '—' },
    { field: 'group', headerName: 'Grupo', width: 150, valueGetter: (v) => v?.name ?? '—' },
    {
      field: 'published',
      headerName: 'Estado',
      width: 170,
      renderCell: (params) =>
        params.row.published ? (
          <Label variant="soft" color="success">
            Publicada {fDate(params.row.published_at)}
          </Label>
        ) : (
          <Label variant="soft" color="default">
            Borrador
          </Label>
        ),
    },
    { field: 'updated_at', headerName: 'Actualizada', width: 130, valueGetter: (v) => fDate(v) },
    {
      field: 'actions',
      headerName: ' ',
      width: 190,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Box sx={{ gap: 1, display: 'flex' }}>
          {can('update') && (
            <Button
              size="small"
              component={RouterLink}
              href={paths.dashboard.careSheet.edit(params.row.id)}
            >
              Editar
            </Button>
          )}
          {can('delete') && (
            <Button size="small" color="error" onClick={() => setRowToDelete(params.row)}>
              Eliminar
            </Button>
          )}
        </Box>
      ),
    },
  ];

  return (
    <>
      <DashboardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <CustomBreadcrumbs
          heading="Fichas de cuidados"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Fichas de cuidados' },
          ]}
          action={
            can('create') && (
              <Button
                component={RouterLink}
                href={paths.dashboard.careSheet.new}
                variant="contained"
              >
                + Ficha nueva
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
            rows={careSheets}
            columns={columns}
            loading={careSheetsLoading}
            pageSizeOptions={[25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            slots={{
              noRowsOverlay: () => (
                <EmptyContent
                  title="Sin fichas de cuidados"
                  description="Crea la primera con «+ Ficha nueva»"
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
            ¿Eliminar la ficha de cuidados de{' '}
            <strong>{rowToDelete && <SheetName sheet={rowToDelete} />}</strong>? Se quita también
            del sitio.
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
