import { useSearchParams } from 'react-router';
import { useBoolean } from 'minimal-shared/hooks';
import { useRef, useState, useCallback } from 'react';

import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import { Toolbar, DataGrid, gridClasses } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';

import { DashboardContent } from 'src/layouts/dashboard';
import { deleteAnimal, useAllGenera, useGetAnimals, useAllSpecies, useAnimalGroupTree } from 'src/actions/animal';

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
  CustomGridActionsCellItem,
  CustomToolbarColumnsButton,
  CustomToolbarSettingsButton,
} from 'src/components/custom-data-grid';

import { useAuthContext } from 'src/auth/hooks';

import { SEX_LABELS, speciesLabel, STATUS_COLORS, STATUS_LABELS, flattenGroupTree } from '../utils';

// ----------------------------------------------------------------------

export function AnimalListView() {
  const theme = useTheme();
  const confirmDialog = useBoolean();
  const toolbarOptions = useToolbarSettings();

  const { user } = useAuthContext();
  const canCreate = user?.permissions?.includes('animals.create');
  const canUpdate = user?.permissions?.includes('animals.update');
  const canDelete = user?.permissions?.includes('animals.delete');

  // El breadcrumb del detalle enlaza aquí con ?genus_id= / ?species_id=
  const [searchParams] = useSearchParams();

  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [groupFilter, setGroupFilter] = useState('');
  const [genusFilter, setGenusFilter] = useState(() => Number(searchParams.get('genus_id')) || '');
  const [speciesFilter, setSpeciesFilter] = useState(() => Number(searchParams.get('species_id')) || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [rowToDelete, setRowToDelete] = useState(null);

  const { genera: allGenera } = useAllGenera();
  const { species: allSpecies } = useAllSpecies();
  const { groupTree } = useAnimalGroupTree();
  const groupsFlat = flattenGroupTree(groupTree);

  const speciesOptions = genusFilter
    ? allSpecies.filter((s) => s.genus?.id === Number(genusFilter))
    : allSpecies;

  const { animals, animalsTotal, animalsLoading, animalsError, animalsMutate } = useGetAnimals({
    page: paginationModel.page + 1,
    pageSize: paginationModel.pageSize,
    groupId: groupFilter || undefined,
    genusId: genusFilter || undefined,
    speciesId: speciesFilter || undefined,
    status: statusFilter || undefined,
  });

  const rowCountRef = useRef(animalsTotal);
  if (!animalsLoading) rowCountRef.current = animalsTotal;

  const handleFilter = useCallback((setter) => (event) => {
    setter(event.target.value);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, []);

  const handleDeleteRow = useCallback(
    (id) => {
      setRowToDelete(id);
      confirmDialog.onTrue();
    },
    [confirmDialog]
  );

  const handleConfirmDelete = useCallback(async () => {
    try {
      await deleteAnimal(rowToDelete);
      await animalsMutate();
      toast.success('Animal eliminado');
    } catch (error) {
      // el backend rechaza con detalle descriptivo (vendido / en una venta)
      toast.error(error.message || 'Error al eliminar');
    } finally {
      setRowToDelete(null);
      confirmDialog.onFalse();
    }
  }, [rowToDelete, animalsMutate, confirmDialog]);

  const columns = [
    {
      field: 'code',
      headerName: 'Código',
      width: 200,
      hideable: false,
      renderCell: (params) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar
            src={params.row.image || params.row.photos?.[0] || ''}
            variant="rounded"
            sx={{ width: 36, height: 36, bgcolor: 'background.neutral' }}
          >
            <Iconify icon="solar:camera-bold" width={18} />
          </Avatar>
          <Link
            component={RouterLink}
            href={paths.dashboard.animal.details(params.row.id)}
            color="inherit"
            underline="hover"
          >
            {params.row.code}
          </Link>
        </div>
      ),
    },
    {
      field: 'species',
      headerName: 'Nombre común',
      flex: 1,
      minWidth: 150,
      sortable: false,
      valueGetter: (v) => v?.common_name ?? '—',
    },
    {
      field: 'genus',
      headerName: 'Género',
      width: 130,
      sortable: false,
      valueGetter: (_, row) => row.species?.genus?.name ?? '—',
    },
    {
      field: 'species_name',
      headerName: 'Especie',
      width: 130,
      sortable: false,
      valueGetter: (_, row) => row.species?.name ?? '—',
    },
    {
      field: 'morphs',
      headerName: 'Morphs',
      flex: 1,
      minWidth: 160,
      sortable: false,
      valueGetter: (v) => (v?.length ? v.map((m) => m.name).join(', ') : '—'),
    },
    {
      field: 'sex',
      headerName: 'Sexo',
      width: 110,
      valueGetter: (v) => SEX_LABELS[v] ?? v,
    },
    {
      field: 'birth_date',
      headerName: 'Nacimiento',
      width: 120,
      valueGetter: (v) => v ?? '—',
    },
    {
      field: 'price',
      headerName: 'Precio',
      width: 110,
      valueGetter: (v) => fCurrency(v),
    },
    {
      field: 'status',
      headerName: 'Estado',
      width: 120,
      renderCell: (params) => (
        <Label variant="soft" color={STATUS_COLORS[params.row.status] ?? 'default'}>
          {STATUS_LABELS[params.row.status] ?? params.row.status}
        </Label>
      ),
    },
    {
      field: 'legal_doc',
      headerName: 'Doc. legal',
      width: 130,
      sortable: false,
      renderCell: (params) => {
        if (!params.row.requires_legal_doc) return '—';
        if (!params.row.legal_doc) {
          return (
            <Label variant="soft" color="warning">
              Pendiente
            </Label>
          );
        }
        const folio = (
          <Label variant="soft" color="success" sx={{ cursor: params.row.legal_doc_url ? 'pointer' : 'default' }}>
            {params.row.legal_doc}
          </Label>
        );
        return params.row.legal_doc_url ? (
          <Link href={params.row.legal_doc_url} target="_blank" rel="noopener" underline="none">
            {folio}
          </Link>
        ) : (
          folio
        );
      },
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
        <CustomGridActionsCellItem showInMenu label="Ver detalle" icon={<Iconify icon="solar:eye-bold" />} href={paths.dashboard.animal.details(params.row.id)} />,
        ...(canUpdate ? [<CustomGridActionsCellItem showInMenu label="Editar" icon={<Iconify icon="solar:pen-bold" />} href={paths.dashboard.animal.edit(params.row.id)} />] : []),
        ...(canDelete && params.row.status !== 'sold' ? [<CustomGridActionsCellItem showInMenu label="Eliminar" icon={<Iconify icon="solar:trash-bin-trash-bold" />} onClick={() => handleDeleteRow(params.row.id)} style={{ color: theme.vars.palette.error.main }} />] : []),
      ],
    },
  ];

  return (
    <>
      <DashboardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <CustomBreadcrumbs
          heading="Animales"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Animales' },
          ]}
          action={canCreate && (
            <Button
              component={RouterLink}
              href={paths.dashboard.animal.new}
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Nuevo animal
            </Button>
          )}
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
            disableRowSelectionOnClick
            paginationMode="server"
            rows={animals}
            columns={columns}
            loading={animalsLoading}
            rowCount={rowCountRef.current}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[25, 50, 100]}
            slots={{
              // un 403 (rol sin animals.read) se veía como lista vacía — mostrar el error
              noRowsOverlay: () =>
                animalsError ? (
                  <EmptyContent
                    title="No se pudieron cargar los animales"
                    description={animalsError.message}
                  />
                ) : (
                  <EmptyContent />
                ),
              noResultsOverlay: () => <EmptyContent title="Sin resultados" />,
              toolbar: () => (
                <Toolbar>
                  <ToolbarContainer>
                    <ToolbarLeftPanel>
                      <TextField
                        select
                        size="small"
                        label="Grupo"
                        value={groupFilter}
                        onChange={handleFilter(setGroupFilter)}
                        sx={{ minWidth: 180 }}
                      >
                        <MenuItem value="">Todos</MenuItem>
                        {groupsFlat.map((g) => (
                          <MenuItem key={g.id} value={g.id} sx={{ pl: 2 + g.depth * 2 }}>
                            {g.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        size="small"
                        label="Género"
                        value={genusFilter}
                        onChange={(e) => {
                          setGenusFilter(e.target.value);
                          setSpeciesFilter('');
                          setPaginationModel((prev) => ({ ...prev, page: 0 }));
                        }}
                        sx={{ minWidth: 150 }}
                      >
                        <MenuItem value="">Todos</MenuItem>
                        {allGenera.map((g) => (
                          <MenuItem key={g.id} value={g.id}>
                            {g.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        size="small"
                        label="Especie"
                        value={speciesFilter}
                        onChange={handleFilter(setSpeciesFilter)}
                        sx={{ minWidth: 220 }}
                      >
                        <MenuItem value="">Todas</MenuItem>
                        {speciesOptions.map((s) => (
                          <MenuItem key={s.id} value={s.id}>
                            {speciesLabel(s)}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        size="small"
                        label="Estado"
                        value={statusFilter}
                        onChange={handleFilter(setStatusFilter)}
                        sx={{ minWidth: 160 }}
                      >
                        <MenuItem value="">Todos</MenuItem>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </ToolbarLeftPanel>
                    <ToolbarRightPanel>
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
        content="¿Estás seguro de eliminar este animal?"
        action={
          <Button variant="contained" color="error" onClick={handleConfirmDelete}>
            Eliminar
          </Button>
        }
      />
    </>
  );
}
