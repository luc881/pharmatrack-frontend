import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import { Toolbar, DataGrid, gridClasses, useGridApiRef } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';

import axiosInstance, { fetcher } from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';
import {
  updateMorph,
  useAllGenera,
  useAllMorphs,
  useGetAnimals,
  useAllSpecies,
  updateSpecies,
  updateAnimalGroup,
  useAnimalGroupTree,
} from 'src/actions/animal';

import { Label } from 'src/components/label';
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

import { speciesLabel, flattenGroupTree } from '../utils';
import { TaxonDialog, TAXON_ACTIONS } from '../taxon-dialog';
import {
  STOCK,
  StatCard,
  HUSBANDRY,
  ManageDialog,
  stockStateOf,
  DEFAULT_LOW_STOCK,
} from './cultivos-view';

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

// Campos cuyo clic no debe navegar al siguiente nivel de la taxonomía
const CONTROL_FIELDS = new Set(['actions', 'show_public', 'show_in_nav', 'feature_home']);

// Iconos de las acciones, creados UNA sola vez a nivel de módulo.
//
// Al hacer clic, el DataGrid enfoca la celda y la vuelve a renderizar entre el
// mousedown y el mouseup. Si el elemento <Iconify> se crea en cada render, el
// <path> del svg se reemplaza en ese hueco y Chrome ya no dispara el click:
// había que dar clic dos veces. Con la misma referencia React no toca ese
// subárbol y el clic llega a la primera.
const ACTION_ICONS = {
  ficha: <Iconify icon="solar:document-text-bold" />,
  sell: <Iconify icon="solar:cart-plus-bold" />,
  cultivo: <Iconify icon="solar:leaf-bold" />,
  add: <Iconify icon="mingcute:add-line" />,
  edit: <Iconify icon="solar:pen-bold" />,
  delete: <Iconify icon="solar:trash-bin-trash-bold" sx={{ color: 'error.main' }} />,
};

const TABS = [
  { value: 'groups', label: 'Grupos', singular: 'grupo', resource: 'animalgroups' },
  { value: 'genera', label: 'Géneros', singular: 'género', resource: 'genera' },
  { value: 'species', label: 'Especies', singular: 'especie', resource: 'species' },
  { value: 'morphs', label: 'Morphs', singular: 'morph', resource: 'morphs' },
];

// ----------------------------------------------------------------------

export function AnimalTaxonomyView() {
  const navigate = useNavigate();
  const apiRef = useGridApiRef();

  const { user } = useAuthContext();

  const [tabValue, setTabValue] = useState('groups');
  // Filtro encadenado al dar clic en una fila: {type: group|genus|species, id, label}.
  // Persiste al cambiar de tab, así "todo lo relacionado" se ve en cada nivel.
  const [filter, setFilter] = useState(null);
  const [dialog, setDialog] = useState(null); // { current } — abierto si no es null
  const [rowToDelete, setRowToDelete] = useState(null);
  const [managing, setManaging] = useState(null); // especie cuyo cultivo se gestiona

  const { groupTree, groupTreeLoading, groupTreeMutate } = useAnimalGroupTree();

  // Alterna una bandera del grupo sin abrir el dialogo. El PUT es parcial,
  // asi que manda solo el campo tocado.
  const handleFlag = async (row, field, value) => {
    // Optimista: la casilla se mueve al instante y el ida y vuelta al servidor
    // ocurre detrás. Si falla, el revalidado la devuelve a su valor real.
    const patch = (nodes) =>
      nodes.map((node) => ({
        ...node,
        ...(node.id === row.id && { [field]: value }),
        children: node.children ? patch(node.children) : node.children,
      }));

    groupTreeMutate((current) => patch(current ?? []), { revalidate: false });
    try {
      await updateAnimalGroup(row.id, { [field]: value });
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar');
    } finally {
      await groupTreeMutate();
    }
  };

  const { genera, generaLoading, generaMutate } = useAllGenera();
  const { species: allSpecies, speciesLoading, speciesMutate } = useAllSpecies();
  // Todos los morphs: ahora cuelgan de su especie en la misma tabla.
  const { morphs, morphsLoading, morphsMutate } = useAllMorphs();

  // "Cultivos" dentro de la pestaña Especies: unidades disponibles derivadas del
  // inventario más el estado de stock/cría por especie. Mismo cálculo que la
  // vista Cultivos, reutilizando sus helpers.
  const { animals } = useGetAnimals({ page: 1, pageSize: 500 });
  const availableBySpecies = useMemo(() => {
    const map = {};
    animals.forEach((a) => {
      if (a.status !== 'available' || !a.species_id) return;
      map[a.species_id] = (map[a.species_id] ?? 0) + (a.stock ?? 1);
    });
    return map;
  }, [animals]);
  // Unidades por morph: un animal puede tener varios morphs, suma su stock a cada uno
  const availableByMorph = useMemo(() => {
    const map = {};
    animals.forEach((a) => {
      if (a.status !== 'available') return;
      (a.morphs ?? []).forEach((m) => {
        map[m.id] = (map[m.id] ?? 0) + (a.stock ?? 1);
      });
    });
    return map;
  }, [animals]);
  // Unidades disponibles de una fila de la pestaña Especies (especie o morph)
  const rowUnits = (row) =>
    (row.__kind === 'morph' ? availableByMorph[row.id] : availableBySpecies[row.id]) ?? 0;
  const cultivoCounts = useMemo(() => {
    const list = allSpecies.map((sp) => ({
      status: sp.husbandry_status ?? 'active',
      state: stockStateOf(availableBySpecies[sp.id] ?? 0, sp.low_stock_threshold ?? DEFAULT_LOW_STOCK),
    }));
    return {
      total: list.length,
      active: list.filter((r) => r.status === 'active').length,
      low: list.filter((r) => r.state === 'low').length,
      out: list.filter((r) => r.state === 'out').length,
    };
  }, [allSpecies, availableBySpecies]);

  const groupsFlat = flattenGroupTree(groupTree);
  const speciesById = Object.fromEntries(allSpecies.map((s) => [s.id, s]));
  const generaById = Object.fromEntries(genera.map((g) => [g.id, g]));

  // Especies con sus morphs anidados debajo (nivel 1), como el árbol de grupos.
  // Así no hace falta una pestaña aparte para morphs.
  const speciesTree = useMemo(() => {
    const bySpecies = {};
    morphs.forEach((m) => {
      (bySpecies[m.species_id] ??= []).push(m);
    });
    const rows = [];
    allSpecies.forEach((sp) => {
      rows.push({ ...sp, _rowId: `s${sp.id}`, __kind: 'species', depth: 0 });
      (bySpecies[sp.id] ?? []).forEach((m) =>
        rows.push({ ...m, _rowId: `m${m.id}`, __kind: 'morph', depth: 1, __speciesId: sp.id })
      );
    });
    return rows;
  }, [allSpecies, morphs]);

  // Deep-link desde la lista de animales: ?edit_species=ID abre la ficha de esa
  // especie (tab Especies, filtrada, con el diálogo de edición abierto).
  const [searchParams, setSearchParams] = useSearchParams();
  const editSpeciesId = searchParams.get('edit_species');
  useEffect(() => {
    if (!editSpeciesId || speciesLoading) return;
    const sp = allSpecies.find((s) => s.id === Number(editSpeciesId));
    if (sp) {
      setTabValue('species');
      setFilter({ type: 'species', id: sp.id, label: `Especie: ${speciesLabel(sp)}` });
      setDialog({ tab: 'species', current: sp });
    }
    searchParams.delete('edit_species');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSpeciesId, speciesLoading]);

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
      // Los morphs siguen a su especie: se filtra por la especie en ambos casos.
      const sp = row.__kind === 'morph' ? speciesById[row.__speciesId] : row;
      if (!sp) return false;
      if (!filter) return true;
      if (filter.type === 'group') return groupIdSet.has(generaById[sp.genus_id]?.group?.id);
      if (filter.type === 'genus') return sp.genus_id === filter.id;
      return sp.id === filter.id;
    },
  };

  // Clic en una fila baja un nivel: grupo → géneros, género → especies, especie → morphs
  const drillDown = {
    groups: (row) => ({ next: 'genera', filter: { type: 'group', id: row.id, label: `Grupo: ${row.name}` } }),
    genera: (row) => ({ next: 'species', filter: { type: 'genus', id: row.id, label: `Género: ${row.name}` } }),
    // Especies ya no baja de nivel: sus morphs se ven anidados en la misma tabla.
  };

  const handleCellClick = (params) => {
    // Columnas con controles propios: ahí el clic es para el control, no para
    // bajar al siguiente nivel. Se listan juntas para que agregar otra columna
    // de este tipo no vuelva a chocar con el drill-down.
    if (CONTROL_FIELDS.has(params.field) || !drillDown[tabValue]) return;
    const { next, filter: nextFilter } = drillDown[tabValue](params.row);
    setFilter(nextFilter);
    setTabValue(next);
    apiRef.current?.setQuickFilterValues([]);
  };

  // Permisos por tipo de taxón (species y morphs conviven en la misma tabla).
  const canDo = (kind, action) =>
    user?.permissions?.includes(`${TABS.find((t) => t.value === kind).resource}.${action}`);
  const can = (action) => canDo(tabValue, action);
  const canSell = user?.permissions?.includes('animals.create');

  // Revalida el recurso correcto tras guardar/eliminar.
  const mutateFor = (kind) =>
    ({
      // renombrar/mover un grupo cambia lo que muestran los géneros
      groups: () => Promise.all([groupTreeMutate(), generaMutate()]),
      genera: generaMutate,
      species: speciesMutate,
      morphs: morphsMutate,
    })[kind];

  const handleConfirmDelete = async () => {
    try {
      await TAXON_ACTIONS[rowToDelete.kind].delete(rowToDelete.row.id);
      await mutateFor(rowToDelete.kind)();
      toast.success('Eliminado correctamente');
    } catch (error) {
      // el backend rechaza con detalle descriptivo si tiene dependencias
      toast.error(error.message || 'Error al eliminar');
    } finally {
      setRowToDelete(null);
    }
  };

  const actionsColumn = {
    type: 'actions',
    field: 'actions',
    headerName: ' ',
    // La especie tiene hasta 6 acciones (Ver ficha + Gestionar cultivo + Añadir
    // morph + Poner a la venta + Editar + Eliminar); el resto de niveles, 2
    width: tabValue === 'species' ? 260 : 96,
    align: 'right',
    headerAlign: 'right',
    sortable: false,
    filterable: false,
    disableColumnMenu: true,
    getActions: (params) => {
      const { row } = params;
      // En la pestaña Especies conviven especies (nivel 0) y sus morphs (nivel 1)
      const kind = tabValue === 'species' ? (row.__kind === 'morph' ? 'morphs' : 'species') : tabValue;
      // Alta de ejemplar con la taxonomía ya elegida: el formulario lee estos
      // parámetros y prellena género, especie y morph.
      const sellHref =
        kind === 'morphs'
          ? `${paths.dashboard.animal.new}?species_id=${row.__speciesId}&morph_id=${row.id}`
          : `${paths.dashboard.animal.new}?species_id=${row.id}`;

      return [
        ...(kind === 'species'
          ? [<CustomGridActionsCellItem label="Ver ficha" icon={ACTION_ICONS.ficha} onClick={() => navigate(paths.dashboard.animal.species(row.id))} />]
          : []),
        ...(tabValue === 'species' && canDo(kind, 'update')
          ? [<CustomGridActionsCellItem label="Gestionar cultivo" icon={ACTION_ICONS.cultivo} onClick={() => setManaging({ row, kind })} />]
          : []),
        ...(kind === 'species' && canDo('morphs', 'create')
          ? [<CustomGridActionsCellItem label="Añadir morph" icon={ACTION_ICONS.add} onClick={() => setDialog({ tab: 'morphs', current: null, initial: { species_id: row.id } })} />]
          : []),
        ...(tabValue === 'species' && canSell
          ? [<CustomGridActionsCellItem label="Poner a la venta" icon={ACTION_ICONS.sell} onClick={() => navigate(sellHref)} />]
          : []),
        ...(canDo(kind, 'update')
          ? [<CustomGridActionsCellItem label="Editar" icon={ACTION_ICONS.edit} onClick={() => setDialog({ tab: kind, current: row })} />]
          : []),
        ...(canDo(kind, 'delete')
          ? [<CustomGridActionsCellItem label="Eliminar" icon={ACTION_ICONS.delete} onClick={() => setRowToDelete({ row, kind })} />]
          : []),
      ];
    },
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
          headerName: 'Visible',
          width: 90,
          sortable: false,
          align: 'center',
          headerAlign: 'center',
          renderCell: (params) =>
            // La visibilidad se controla por grupo raiz: ocultar uno esconde
            // todo su subarbol, asi que en los hijos no hay nada que marcar.
            params.row.depth === 0 ? (
              <Checkbox
                checked={params.row.show_public !== false}
                disabled={!can('update')}
                onChange={(e) => handleFlag(params.row, 'show_public', e.target.checked)}
              />
            ) : (
              <Box sx={{ color: 'text.disabled' }}>—</Box>
            ),
        },
        {
          field: 'show_in_nav',
          headerName: 'En el menú',
          width: 110,
          sortable: false,
          align: 'center',
          headerAlign: 'center',
          renderCell: (params) =>
            // El menú del sitio lista grupos raíz; en subgrupos no aplica
            params.row.depth === 0 ? (
              <Checkbox
                checked={params.row.show_in_nav !== false}
                disabled={!can('update') || params.row.show_public === false}
                onChange={(e) => handleFlag(params.row, 'show_in_nav', e.target.checked)}
              />
            ) : (
              <Box sx={{ color: 'text.disabled' }}>—</Box>
            ),
        },
        {
          field: 'feature_home',
          headerName: 'Destacado',
          width: 110,
          sortable: false,
          align: 'center',
          headerAlign: 'center',
          renderCell: (params) => {
            // Un raiz oculto no puede destacarse; un subgrupo si
            const canFeature = params.row.depth > 0 || params.row.show_public !== false;
            return (
              <Checkbox
                checked={!!params.row.feature_home}
                disabled={!can('update') || !canFeature}
                onChange={(e) => handleFlag(params.row, 'feature_home', e.target.checked)}
              />
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
      rows: speciesTree,
      loading: speciesLoading || morphsLoading,
      columns: [
        // sortable:false en todas: ordenar rompería el anidado especie → morphs
        { field: 'genus', headerName: 'Género', width: 180, sortable: false, valueGetter: (_, row) => (row.__kind === 'morph' ? '' : row.genus?.name ?? '—') },
        {
          field: 'name',
          headerName: 'Nombre científico',
          flex: 1,
          minWidth: 200,
          sortable: false,
          renderCell: (params) => (
            <Box sx={{ pl: params.row.depth * 3 }}>
              {params.row.depth > 0 && '└ '}
              {params.row.name}
            </Box>
          ),
        },
        { field: 'common_name', headerName: 'Nombre común / morph', flex: 1, minWidth: 180, sortable: false, valueGetter: (_, row) => (row.__kind === 'morph' ? row.description ?? '—' : row.common_name ?? '—') },
        // Columnas de "Cultivos": aplican a especies y morphs (cría independiente)
        {
          field: 'units',
          headerName: 'Disponibles',
          width: 110,
          align: 'right',
          headerAlign: 'right',
          sortable: false,
          renderCell: (params) => rowUnits(params.row),
        },
        {
          field: 'stock',
          headerName: 'Stock',
          width: 120,
          sortable: false,
          renderCell: (params) => {
            const state = stockStateOf(rowUnits(params.row), params.row.low_stock_threshold ?? DEFAULT_LOW_STOCK);
            return <Label variant="soft" color={STOCK[state].color}>{STOCK[state].label}</Label>;
          },
        },
        {
          field: 'husbandry',
          headerName: 'Cría',
          width: 120,
          sortable: false,
          renderCell: (params) => {
            const status = params.row.husbandry_status ?? 'active';
            return <Label variant="soft" color={HUSBANDRY[status]?.color ?? 'default'}>{HUSBANDRY[status]?.label ?? status}</Label>;
          },
        },
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
                  onClick={() => setDialog({ tab: tabValue, current: null })}
                >
                  {`Nuevo ${tabConfig.singular}`}
                </Button>
              )}
            </Stack>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        {tabValue === 'species' && (
          <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <StatCard label="Especies" value={cultivoCounts.total} />
            <StatCard label="En cultivo" value={cultivoCounts.active} color="success.main" />
            <StatCard label="Bajo stock" value={cultivoCounts.low} color="warning.main" />
            <StatCard label="Agotadas" value={cultivoCounts.out} color="error.main" />
          </Stack>
        )}

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
            {TABS.filter((t) => t.value !== 'morphs').map((tab) => (
              <Tab key={tab.value} value={tab.value} label={tab.label} />
            ))}
          </Tabs>

          <DataGrid
            apiRef={apiRef}
            ignoreDiacritics
            disableRowSelectionOnClick
            rows={gridProps.rows.filter(passesFilter[tabValue])}
            columns={gridProps.columns}
            getRowId={(row) => row._rowId ?? row.id}
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
                      {drillDown[tabValue] && (
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
              ...(drillDown[tabValue] && { [`& .${gridClasses.row}`]: { cursor: 'pointer' } }),
            }}
          />
        </Card>
      </DashboardContent>

      {dialog && (
        <TaxonDialog
          tab={dialog.tab}
          singular={TABS.find((t) => t.value === dialog.tab).singular}
          current={dialog.current}
          initial={dialog.initial}
          genera={genera}
          allSpecies={allSpecies}
          groupsFlat={groupsFlat}
          onClose={() => setDialog(null)}
          onSaved={mutateFor(dialog.tab)}
        />
      )}

      {managing && (
        <ManageDialog
          species={managing.row}
          title={managing.kind === 'morphs' ? managing.row.name : undefined}
          update={managing.kind === 'morphs' ? updateMorph : updateSpecies}
          onClose={() => setManaging(null)}
          onSaved={managing.kind === 'morphs' ? morphsMutate : speciesMutate}
        />
      )}

      <ConfirmDialog
        open={!!rowToDelete}
        onClose={() => setRowToDelete(null)}
        title="Eliminar"
        content={
          <>
            ¿Estás seguro de eliminar <strong>{rowToDelete?.row?.name}</strong>?
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
