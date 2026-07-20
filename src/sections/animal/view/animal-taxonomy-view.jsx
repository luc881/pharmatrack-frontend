import useSWR from 'swr';
import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import { Toolbar, DataGrid, gridClasses, useGridApiRef } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';

import axiosInstance, { fetcher } from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';
import {
  useAllGenera,
  useAllMorphs,
  useAllSpecies,
  useAnimalGroupTree,
} from 'src/actions/animal';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import {
  ToolbarContainer,
  ToolbarRightPanel,
  CustomToolbarQuickFilter,
  CustomGridActionsCellItem,
  CustomToolbarFilterButton,
  CustomToolbarExportButton,
  CustomToolbarColumnsButton,
} from 'src/components/custom-data-grid';

import { useAuthContext } from 'src/auth/hooks';

import { TaxonDialog, TAXON_ACTIONS } from '../taxon-dialog';
import { speciesLabel, saleFormatLabel, flattenGroupTree } from '../utils';

// ----------------------------------------------------------------------

// Ajuste global del sitio: muestra u oculta la sección "Explora por grupo"
// en la página principal. Útil cuando aún hay pocas categorías con animales.
function CategoryBrowseToggle() {
  const { data, mutate } = useSWR('/api/v1/settings/site', fetcher, {
    revalidateOnFocus: false,
  });
  const [saving, setSaving] = useState(false);

  const onToggle = async (e) => {
    const show_category_browse = e.target.checked;
    setSaving(true);
    try {
      const res = await axiosInstance.put('/api/v1/settings/site', { show_category_browse });
      await mutate(res.data, { revalidate: false });
      toast.success('Ajuste guardado');
    } catch (error) {
      toast.error(error?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormControlLabel
      sx={{ mr: 0 }}
      disabled={!data || saving}
      control={
        <Switch checked={data?.show_category_browse ?? true} onChange={onToggle} />
      }
      label={<Typography variant="body2">Explorar por categorías</Typography>}
    />
  );
}

// ----------------------------------------------------------------------

const TABS = [
  { value: 'groups', label: 'Grupos', singular: 'grupo', resource: 'animalgroups' },
  { value: 'genera', label: 'Géneros', singular: 'género', resource: 'genera' },
  { value: 'species', label: 'Especies', singular: 'especie', resource: 'species' },
  { value: 'morphs', label: 'Morphs', singular: 'morph', resource: 'morphs' },
];

// ----------------------------------------------------------------------

export function AnimalTaxonomyView() {
  const theme = useTheme();
  const apiRef = useGridApiRef();

  const { user } = useAuthContext();

  const [tabValue, setTabValue] = useState('groups');
  // Filtro encadenado al dar clic en una fila: {type: group|genus|species, id, label}.
  // Persiste al cambiar de tab, así "todo lo relacionado" se ve en cada nivel.
  const [filter, setFilter] = useState(null);
  const [dialog, setDialog] = useState(null); // { current } — abierto si no es null
  const [rowToDelete, setRowToDelete] = useState(null);

  const { groupTree, groupTreeLoading, groupTreeMutate } = useAnimalGroupTree();
  const { genera, generaLoading, generaMutate } = useAllGenera();
  const { species: allSpecies, speciesLoading, speciesMutate } = useAllSpecies();
  const { morphs, morphsLoading, morphsMutate } = useAllMorphs(
    filter?.type === 'species' ? filter.id : undefined
  );

  const groupsFlat = flattenGroupTree(groupTree);
  const speciesById = Object.fromEntries(allSpecies.map((s) => [s.id, s]));
  const generaById = Object.fromEntries(genera.map((g) => [g.id, g]));

  // Un grupo filtra también a sus descendientes (los géneros cuelgan de cualquier nivel)
  const groupIdSet =
    filter?.type === 'group'
      ? new Set([filter.id, ...groupsFlat.filter((g) => g.ancestors.includes(filter.id)).map((g) => g.id)])
      : null;

  const passesFilter = {
    groups: (row) => !groupIdSet || groupIdSet.has(row.id),
    genera: (row) => {
      if (!filter) return true;
      if (filter.type === 'group') return groupIdSet.has(row.group?.id);
      if (filter.type === 'genus') return row.id === filter.id;
      return true;
    },
    species: (row) => {
      if (!filter) return true;
      if (filter.type === 'group') return groupIdSet.has(generaById[row.genus_id]?.group?.id);
      if (filter.type === 'genus') return row.genus_id === filter.id;
      return row.id === filter.id;
    },
    morphs: (row) => {
      if (!filter || filter.type === 'species') return true; // species ya filtró el server
      const sp = speciesById[row.species_id];
      if (filter.type === 'group') return groupIdSet.has(generaById[sp?.genus_id]?.group?.id);
      return sp?.genus_id === filter.id;
    },
  };

  // Clic en una fila baja un nivel: grupo → géneros, género → especies, especie → morphs
  const drillDown = {
    groups: (row) => ({ next: 'genera', filter: { type: 'group', id: row.id, label: `Grupo: ${row.name}` } }),
    genera: (row) => ({ next: 'species', filter: { type: 'genus', id: row.id, label: `Género: ${row.name}` } }),
    species: (row) => ({ next: 'morphs', filter: { type: 'species', id: row.id, label: `Especie: ${speciesLabel(row)}` } }),
  };

  const handleCellClick = (params) => {
    if (params.field === 'actions' || !drillDown[tabValue]) return;
    const { next, filter: nextFilter } = drillDown[tabValue](params.row);
    setFilter(nextFilter);
    setTabValue(next);
    apiRef.current?.setQuickFilterValues([]);
  };

  const can = (action) =>
    user?.permissions?.includes(`${TABS.find((t) => t.value === tabValue).resource}.${action}`);

  const mutateCurrent = {
    // renombrar/mover un grupo cambia lo que muestran los géneros
    groups: () => Promise.all([groupTreeMutate(), generaMutate()]),
    genera: generaMutate,
    species: speciesMutate,
    morphs: morphsMutate,
  }[tabValue];

  const handleConfirmDelete = useCallback(async () => {
    try {
      await TAXON_ACTIONS[tabValue].delete(rowToDelete.id);
      await mutateCurrent();
      toast.success('Eliminado correctamente');
    } catch (error) {
      // el backend rechaza con detalle descriptivo si tiene dependencias
      toast.error(error.message || 'Error al eliminar');
    } finally {
      setRowToDelete(null);
    }
  }, [tabValue, rowToDelete, mutateCurrent]);

  const actionsColumn = {
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
      ...(can('update') ? [<CustomGridActionsCellItem label="Editar" icon={<Iconify icon="solar:pen-bold" />} onClick={() => setDialog({ current: params.row })} />] : []),
      ...(can('delete') ? [<CustomGridActionsCellItem label="Eliminar" icon={<Iconify icon="solar:trash-bin-trash-bold" sx={{ color: theme.vars.palette.error.main }} />} onClick={() => setRowToDelete(params.row)} />] : []),
    ],
  };

  const gridProps = {
    groups: {
      rows: groupsFlat,
      loading: groupTreeLoading,
      columns: [
        {
          field: 'name',
          headerName: 'Nombre',
          flex: 1,
          minWidth: 240,
          sortable: false, // el orden del árbol es la jerarquía
          renderCell: (params) => (
            <Box sx={{ pl: params.row.depth * 3 }}>
              {params.row.depth > 0 && '└ '}
              {params.row.name}
            </Box>
          ),
        },
        {
          field: 'show_public',
          headerName: 'Sitio',
          width: 150,
          sortable: false,
          renderCell: (params) => {
            if (params.row.depth !== 0) return null;
            return (
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', height: 1 }}>
                {params.row.show_public === false && (
                  <Chip size="small" color="default" variant="soft" label="Oculto" />
                )}
                {params.row.feature_home && params.row.show_public !== false && (
                  <Chip size="small" color="info" variant="soft" label="Destacado" />
                )}
              </Box>
            );
          },
        },
        actionsColumn,
      ],
    },
    genera: {
      rows: genera,
      loading: generaLoading,
      columns: [
        { field: 'name', headerName: 'Nombre', flex: 1, minWidth: 200 },
        { field: 'group', headerName: 'Grupo', flex: 1, minWidth: 160, valueGetter: (v) => v?.name ?? '—' },
        actionsColumn,
      ],
    },
    species: {
      rows: allSpecies,
      loading: speciesLoading,
      columns: [
        { field: 'genus', headerName: 'Género', width: 180, valueGetter: (v) => v?.name ?? '—' },
        { field: 'name', headerName: 'Nombre científico', flex: 1, minWidth: 180 },
        { field: 'common_name', headerName: 'Nombre común', flex: 1, minWidth: 180, valueGetter: (v) => v ?? '—' },
        { field: 'sale_format', headerName: 'Formato', width: 140, valueGetter: (_, row) => saleFormatLabel(row) ?? 'Individual' },
        actionsColumn,
      ],
    },
    morphs: {
      rows: morphs,
      loading: morphsLoading,
      columns: [
        { field: 'species_id', headerName: 'Especie', width: 240, valueGetter: (v) => speciesLabel(speciesById[v]) || '—' },
        { field: 'name', headerName: 'Nombre', flex: 1, minWidth: 160 },
        { field: 'description', headerName: 'Descripción', flex: 1, minWidth: 200, valueGetter: (v) => v ?? '—' },
        actionsColumn,
      ],
    },
  }[tabValue];

  const tabConfig = TABS.find((t) => t.value === tabValue);

  return (
    <>
      <DashboardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <CustomBreadcrumbs
          heading="Taxonomía"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Animales', href: paths.dashboard.animal.root },
            { name: 'Taxonomía' },
          ]}
          action={
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              {tabValue === 'groups' && can('update') && <CategoryBrowseToggle />}
              {can('create') && (
                <Button
                  variant="contained"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                  onClick={() => setDialog({ current: null })}
                >
                  {`Nuevo ${tabConfig.singular}`}
                </Button>
              )}
            </Stack>
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
          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            sx={{ px: 2.5, boxShadow: (t) => `inset 0 -2px 0 0 ${t.vars.palette.divider}` }}
          >
            {TABS.map((tab) => (
              <Tab key={tab.value} value={tab.value} label={tab.label} />
            ))}
          </Tabs>

          <DataGrid
            apiRef={apiRef}
            ignoreDiacritics
            disableRowSelectionOnClick
            rows={gridProps.rows.filter(passesFilter[tabValue])}
            columns={gridProps.columns}
            loading={gridProps.loading}
            onCellClick={handleCellClick}
            pageSizeOptions={[25, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            slots={{
              noRowsOverlay: () => <EmptyContent />,
              noResultsOverlay: () => <EmptyContent title="Sin resultados" />,
              // Todo en una línea: búsqueda + filtro activo + botones del grid
              toolbar: () => (
                <Toolbar>
                  <ToolbarContainer>
                    <CustomToolbarQuickFilter />

                    {filter && (
                      <Chip color="primary" variant="soft" label={filter.label} onDelete={() => setFilter(null)} />
                    )}

                    <ToolbarRightPanel>
                      {tabValue !== 'morphs' && (
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.disabled', display: { xs: 'none', md: 'block' } }}
                        >
                          Da clic en una fila para ver lo que contiene
                        </Typography>
                      )}
                      <CustomToolbarColumnsButton />
                      <CustomToolbarFilterButton />
                      <CustomToolbarExportButton />
                    </ToolbarRightPanel>
                  </ToolbarContainer>
                </Toolbar>
              ),
            }}
            sx={{
              [`& .${gridClasses.cell}`]: { display: 'flex', alignItems: 'center' },
              ...(tabValue !== 'morphs' && { [`& .${gridClasses.row}`]: { cursor: 'pointer' } }),
            }}
          />
        </Card>
      </DashboardContent>

      {dialog && (
        <TaxonDialog
          tab={tabValue}
          singular={tabConfig.singular}
          current={dialog.current}
          genera={genera}
          allSpecies={allSpecies}
          groupsFlat={groupsFlat}
          onClose={() => setDialog(null)}
          onSaved={mutateCurrent}
        />
      )}

      <ConfirmDialog
        open={!!rowToDelete}
        onClose={() => setRowToDelete(null)}
        title="Eliminar"
        content={
          <>
            ¿Estás seguro de eliminar <strong>{rowToDelete?.name}</strong>?
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
