import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DataGrid, gridClasses } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDate } from 'src/utils/format-time';
import { matchesWords } from 'src/utils/plain';

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

const STATES = [
  { value: '', label: 'Todas' },
  { value: 'published', label: 'Publicadas' },
  { value: 'draft', label: 'Borradores' },
];

// select nativo: rápido en celular y con «Todos» al principio
function FilterSelect({ label, value, onChange, options }) {
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
      sx={{ minWidth: 150 }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </TextField>
  );
}

const asOptions = (values, all) => [
  { value: '', label: all },
  ...[...new Set(values.filter(Boolean))].sort().map((v) => ({ value: v, label: v })),
];

export function CareSheetListView() {
  const { user } = useAuthContext();

  const can = (action) => user?.permissions?.includes(`species.${action}`);

  const [rowToDelete, setRowToDelete] = useState(null);

  const { careSheets, careSheetsLoading, careSheetsMutate } = useGetCareSheets();

  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [group, setGroup] = useState('');
  const [difficulty, setDifficulty] = useState('');

  const rows = useMemo(() => careSheets.filter(
      (s) =>
        matchesWords(`${s.scientific_name} ${s.locality ?? ''} ${s.common_name ?? ''}`, search) &&
        (!state || (state === 'published') === Boolean(s.published)) &&
        (!group || s.group?.name === group) &&
        (!difficulty || s.difficulty === difficulty)
    ), [careSheets, search, state, group, difficulty]);

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
          <Stack
            direction="row"
            sx={{ p: 2, gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}
          >
            <TextField
              size="small"
              type="search"
              placeholder="Buscar especie, localidad o nombre común…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{ htmlInput: { 'aria-label': 'Buscar ficha' } }}
              sx={{ flexGrow: 1, minWidth: 240 }}
            />
            <FilterSelect label="Estado" value={state} onChange={setState} options={STATES} />
            <FilterSelect
              label="Grupo"
              value={group}
              onChange={setGroup}
              options={asOptions(careSheets.map((s) => s.group?.name), 'Todos')}
            />
            <FilterSelect
              label="Dificultad"
              value={difficulty}
              onChange={setDifficulty}
              options={asOptions(careSheets.map((s) => s.difficulty), 'Todas')}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {rows.length === careSheets.length
                ? `${careSheets.length} fichas`
                : `${rows.length} de ${careSheets.length} fichas`}
            </Typography>
          </Stack>
          <DataGrid
            disableRowSelectionOnClick
            rows={rows}
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
