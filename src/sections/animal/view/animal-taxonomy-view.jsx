import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';
import { useLocalStorage } from 'minimal-shared/hooks';
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
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import { Toolbar, DataGrid, gridClasses, useGridApiRef } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';

import { plain } from 'src/utils/plain';

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
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { EmptyList, EmptyContent } from 'src/components/empty-content';
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

import { AnimalCapAlert } from '../animal-cap-alert';
import { TaxonDialog, TAXON_ACTIONS } from '../taxon-dialog';
import { searchText, buildSpeciesTree } from '../taxonomy-rows';
import { purposeOf, speciesLabel, flattenGroupTree } from '../utils';
import {
  STOCK,
  StatCard,
  HUSBANDRY,
  KeptCounts,
  keptUnitsBy,
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

// Flechas del acordeón de morphs. Dos elementos fijos (no una rotación con sx)
// por la misma razón que ACTION_ICONS: así el re-render que provoca el foco de
// la celda reutiliza el mismo elemento y el clic llega a la primera.
const CHEVRON = {
  closed: <Iconify width={16} icon="eva:arrow-ios-forward-fill" />,
  open: <Iconify width={16} icon="eva:arrow-ios-downward-fill" />,
};

const TABS = [
  { value: 'groups', label: 'Grupos', singular: 'grupo', resource: 'animalgroups' },
  { value: 'genera', label: 'Géneros', singular: 'género', resource: 'genera' },
  { value: 'species', label: 'Especies', singular: 'especie', resource: 'species' },
  { value: 'morphs', label: 'Morphs', singular: 'morph', resource: 'morphs' },
];

// Valores admitidos en la URL (?tab= y ?ft=): cualquier otra cosa se ignora,
// así una URL manipulada cae en el estado por defecto en vez de romper la vista.
const TAB_VALUES = ['groups', 'genera', 'species'];
// Filtro "¿se ve en el sitio?" de la pestaña Especies (?web=online|offline).
// Antes vivía en una pantalla aparte (Sitio web → Animales); ahora la
// visibilidad se maneja aquí mismo, junto al resto de la especie.
const WEB_VALUES = ['online', 'offline'];
const FILTER_TYPES = ['group', 'genus', 'species'];

// Columnas ocultas de entrada. Se vuelven a mostrar desde el botón "Columnas"
// de la barra: aquí la taxonomía se sigue por nombre científico, no por el
// nombre común. La elección se guarda en localStorage bajo esta clave, así que
// añadir columnas nuevas aquí sigue funcionando: lo guardado se mezcla encima
// de estos valores por defecto, no los reemplaza.
const COLUMNS_STORAGE_KEY = 'animal-taxonomy-columns';
const HIDE_COLUMNS = { common_name: false };

// ----------------------------------------------------------------------

// Barra de la tabla: búsqueda + filtro activo + botones del grid, en una línea
function TaxonomyToolbar({ chipLabel, onClearFilter, showHint }) {
  return (
    <Toolbar>
      <ToolbarContainer>
        <CustomToolbarQuickFilter />

        {chipLabel && <Chip color="primary" variant="soft" label={chipLabel} onDelete={onClearFilter} />}

        <ToolbarRightPanel>
          {showHint && (
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
  );
}

// ----------------------------------------------------------------------

export function AnimalTaxonomyView() {
  const navigate = useNavigate();
  const apiRef = useGridApiRef();

  const { user } = useAuthContext();

  // La pestaña y el filtro viven en la URL, no en useState: así el botón
  // "atrás" del navegador (o volver desde la ficha de una especie) devuelve a
  // donde estabas —p. ej. Especies filtradas por Isópodos— en vez de reiniciar
  // en Grupos. De paso el estado se puede compartir por enlace.
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const tabValue = TAB_VALUES.includes(tabParam) ? tabParam : 'groups';

  // Filtro encadenado al dar clic en una fila: {type: group|genus|species, id}.
  // Persiste al cambiar de tab, así "todo lo relacionado" se ve en cada nivel.
  const filterType = searchParams.get('ft');
  const filterId = Number(searchParams.get('fid'));
  const filter =
    FILTER_TYPES.includes(filterType) && Number.isInteger(filterId) && filterId > 0
      ? { type: filterType, id: filterId }
      : null;

  // Escribe pestaña + filtro en la URL. Por defecto empuja una entrada de
  // historial, así "atrás" también deshace el último drill-down.
  const webParam = searchParams.get('web');
  const webFilter = WEB_VALUES.includes(webParam) ? webParam : 'all';

  const goTo = (tab, nextFilter, { replace = false, web = webFilter } = {}) => {
    const next = new URLSearchParams();
    if (tab && tab !== 'groups') next.set('tab', tab);
    if (web !== 'all') next.set('web', web);
    if (nextFilter) {
      next.set('ft', nextFilter.type);
      next.set('fid', String(nextFilter.id));
    }
    setSearchParams(next, { replace });
  };

  // URL exacta de esta vista (con pestaña y filtro) para que la ficha de una
  // especie sepa a dónde regresar con su flecha "atrás".
  const currentUrl = () => {
    const qs = searchParams.toString();
    return qs ? `${paths.dashboard.animal.taxonomy}?${qs}` : paths.dashboard.animal.taxonomy;
  };

  const { state: columnVisibilityModel, setState: setColumnVisibilityModel } = useLocalStorage(
    COLUMNS_STORAGE_KEY,
    HIDE_COLUMNS
  );
  const [dialog, setDialogState] = useState(null); // grupos y géneros
  // Especie y variedad se editan en su propia página (fotos y ficha de
  // cuidados); grupos y géneros siguen en el diálogo
  const setDialog = (next) => {
    if (next && (next.tab === 'species' || next.tab === 'morphs')) {
      const isMorph = next.tab === 'morphs';
      const { animal } = paths.dashboard;
      const speciesId = next.initial?.species_id;
      const href = next.current
        ? (isMorph ? animal.morphEdit : animal.speciesEdit)(next.current.id)
        : `${isMorph ? animal.morphNew : animal.speciesNew}${speciesId ? `?species_id=${speciesId}` : ''}`;
      navigate(href, { state: { from: currentUrl() } });
      return;
    }
    setDialogState(next);
  };
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
  // vista Cultivos, reutilizando sus helpers. Bajo stock y Agotadas cuentan solo
  // lo que está en venta; pie de cría y crianza van aparte, debajo del número.
  const { animals, animalsTotal } = useGetAnimals({ page: 1, pageSize: 500 });
  const availableBySpecies = useMemo(() => {
    const map = {};
    animals.forEach((a) => {
      if (a.status !== 'available' || !a.species_id || purposeOf(a) !== 'sale') return;
      map[a.species_id] = (map[a.species_id] ?? 0) + (a.stock ?? 1);
    });
    return map;
  }, [animals]);
  // Unidades por morph: un animal puede tener varios morphs, suma su stock a cada uno
  const availableByMorph = useMemo(() => {
    const map = {};
    animals.forEach((a) => {
      if (a.status !== 'available' || purposeOf(a) !== 'sale') return;
      (a.morphs ?? []).forEach((m) => {
        map[m.id] = (map[m.id] ?? 0) + (a.stock ?? 1);
      });
    });
    return map;
  }, [animals]);
  // Unidades disponibles de una fila de la pestaña Especies (especie o morph)
  const rowUnits = (row) =>
    (row.__kind === 'morph' ? availableByMorph[row.id] : availableBySpecies[row.id]) ?? 0;
  const keptBySpecies = useMemo(() => keptUnitsBy(animals, allSpecies), [animals, allSpecies]);
  const keptByMorph = useMemo(() => keptUnitsBy(animals, allSpecies, true), [animals, allSpecies]);
  const rowKept = (row) => (row.__kind === 'morph' ? keptByMorph[row.id] : keptBySpecies[row.id]);
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

  // ¿Se ve en el sitio? Mismas reglas que el backend del catálogo público:
  // un grupo oculto esconde TODO su subárbol (se recorren ancestros, no solo
  // el grupo inmediato), y un morph de una especie oculta tampoco se ve.
  const groupsById = Object.fromEntries(groupsFlat.map((g) => [g.id, g]));
  const hiddenGroupIds = new Set(
    groupsFlat
      .filter((g) => g.show_public === false || g.ancestors.some((id) => groupsById[id]?.show_public === false))
      .map((g) => g.id)
  );
  // Motivo heredado (no su propio switch) por el que la fila no se ve
  const webReason = (row) => {
    const sp = row.__kind === 'morph' ? speciesById[row.__speciesId] : row;
    const groupId = generaById[sp?.genus_id]?.group?.id ?? sp?.genus?.group?.id;
    if (groupId != null && hiddenGroupIds.has(groupId)) return 'Grupo oculto';
    return null;
  };
  const visibleOnSite = (row) => !webReason(row) && row.show_public !== false;

  // Morphs agrupados por especie: alimenta el contador del acordeón y las filas
  const morphsBySpecies = useMemo(() => {
    const map = {};
    morphs.forEach((m) => {
      (map[m.species_id] ??= []).push(m);
    });
    return map;
  }, [morphs]);

  // Especies con sus morphs anidados debajo (nivel 1), como el árbol de grupos,
  // pero plegados: una especie con muchos morphs empujaba al resto fuera de la
  // página. Solo se insertan las filas de las especies desplegadas.
  const [expanded, setExpanded] = useState(() => new Set());
  const toggleExpanded = (speciesId) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(speciesId)) next.add(speciesId);
      return next;
    });

  // Texto del buscador de la tabla: con algo escrito van todas las variedades
  // (si no, «glacier» no encontraría nada con la especie plegada)
  const [search, setSearch] = useState('');
  const showAllMorphs = webFilter !== 'all' || search.trim() !== '';

  const speciesTree = useMemo(
    () => buildSpeciesTree(allSpecies, morphsBySpecies, { expanded, showAll: showAllMorphs }),
    [allSpecies, morphsBySpecies, expanded, showAllMorphs]
  );

  // Etiqueta del chip del filtro: se deriva de los datos ya cargados, la URL
  // solo guarda tipo + id (así el enlace no arrastra texto ni se desincroniza
  // si renombras el grupo).
  const filterLabel = () => {
    if (!filter) return null;
    if (filter.type === 'group') return `Grupo: ${groupsFlat.find((g) => g.id === filter.id)?.name ?? '…'}`;
    if (filter.type === 'genus') return `Género: ${genera.find((g) => g.id === filter.id)?.name ?? '…'}`;
    const sp = speciesById[filter.id];
    return `Especie: ${sp ? speciesLabel(sp) : '…'}`;
  };

  // Deep-link desde la lista de animales: ?edit_species=ID abre la ficha de esa
  // especie (tab Especies, filtrada, con el diálogo de edición abierto).
  const editSpeciesId = searchParams.get('edit_species');
  useEffect(() => {
    if (!editSpeciesId || speciesLoading) return;
    const sp = allSpecies.find((s) => s.id === Number(editSpeciesId));
    // la ficha de la especie tiene su propia página
    if (sp) {
      navigate(paths.dashboard.animal.speciesEdit(sp.id), { replace: true });
      return;
    }
    goTo(tabValue, filter, { replace: true });
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
      if (webFilter !== 'all' && visibleOnSite(row) !== (webFilter === 'online')) return false;
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
    goTo(next, nextFilter);
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
    // Solo dos iconos a la vista (Ver ficha / Editar). El resto vive en el menú
    // "⋮" con su etiqueta de texto: seis iconos en fila eran indistinguibles.
    // En Especies caben tres controles (Ver ficha + Editar + "⋮"), en el resto
    // dos, así que la columna se ajusta para que no se recorten.
    width: tabValue === 'species' ? 140 : 100,
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
        // Visibles
        ...(kind === 'species'
          ? [<CustomGridActionsCellItem label="Ver ficha" icon={ACTION_ICONS.ficha} onClick={() => navigate(paths.dashboard.animal.species(row.id), { state: { from: currentUrl() } })} />]
          : []),
        ...(canDo(kind, 'update')
          ? [<CustomGridActionsCellItem label={kind === 'species' ? 'Editar especie y ficha' : 'Editar'} icon={ACTION_ICONS.edit} onClick={() => setDialog({ tab: kind, current: row })} />]
          : []),
        // En el menú "⋮", con etiqueta
        ...(kind === 'species' && canDo('morphs', 'create')
          ? [<CustomGridActionsCellItem showInMenu label="Añadir variedad" icon={ACTION_ICONS.add} onClick={() => setDialog({ tab: 'morphs', current: null, initial: { species_id: row.id } })} />]
          : []),
        ...(tabValue === 'species' && canDo(kind, 'update')
          ? [<CustomGridActionsCellItem showInMenu label="Gestionar cultivo" icon={ACTION_ICONS.cultivo} onClick={() => setManaging({ row, kind })} />]
          : []),
        ...(tabValue === 'species' && canSell
          ? [<CustomGridActionsCellItem showInMenu label="Poner a la venta" icon={ACTION_ICONS.sell} onClick={() => navigate(sellHref)} />]
          : []),
        ...(canDo(kind, 'delete')
          ? [<CustomGridActionsCellItem showInMenu label="Eliminar" icon={ACTION_ICONS.delete} onClick={() => setRowToDelete({ row, kind })} />]
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
        {
          field: 'group',
          headerName: 'Grupo',
          flex: 1,
          minWidth: 160,
          valueGetter: (v) => v?.name ?? '',
          // Géneros de antes de que el grupo fuera obligatorio: se marcan para corregirlos
          renderCell: (params) =>
            params.value || (
              <Label variant="soft" color="warning">
                Sin grupo — edítalo
              </Label>
            ),
        },
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
          // El buscador de la tabla compara contra el valor formateado de cada
          // celda; esta columna busca en otro texto: la variedad con su
          // especie y la especie con sus variedades. Mostrar y exportar siguen
          // con el nombre tal cual.
          getApplyQuickFilterFn: (value) => {
            const wanted = plain(value);
            if (!wanted) return null;
            return (_, row) => plain(searchText(row, speciesById, morphsBySpecies)).includes(wanted);
          },
          renderCell: (params) => {
            const { row } = params;
            if (row.__kind === 'morph') {
              // Al buscar o filtrar, la variedad puede salir sin su especie
              // arriba: se dice de cuál es para no dejarla huérfana.
              const parent = showAllMorphs ? speciesById[row.__speciesId]?.name : null;
              return (
                <Box sx={{ pl: 3 }}>
                  └ {row.name}
                  {parent && (
                    <Box component="span" sx={{ ml: 1, color: 'text.disabled', fontStyle: 'italic' }}>
                      {parent}
                    </Box>
                  )}
                </Box>
              );
            }

            const count = morphsBySpecies[row.id]?.length ?? 0;
            const open = expanded.has(row.id);

            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                {/* Al buscar o filtrar las variedades ya salen todas: la flecha no aplica */}
                {count > 0 && !showAllMorphs ? (
                  <IconButton
                    size="small"
                    onClick={() => toggleExpanded(row.id)}
                    aria-label={open ? 'Ocultar morphs' : `Ver ${count} morphs`}
                    sx={{ flexShrink: 0 }}
                  >
                    {open ? CHEVRON.open : CHEVRON.closed}
                  </IconButton>
                ) : (
                  // hueco del mismo ancho para que los nombres queden alineados
                  <Box sx={{ width: 30, flexShrink: 0 }} />
                )}

                <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.name}
                </Box>

                {/* "Nominal" dice QUÉ es la fila (la forma base), siempre presente
                    tenga morphs o no. Variante outlined para no confundirse con
                    los Label soft de Stock/Cría de esta misma tabla. */}
                <Label variant="outlined" color="info" sx={{ flexShrink: 0 }}>
                  Nominal
                </Label>

                {count > 0 && (
                  <Box component="span" sx={{ flexShrink: 0, color: 'text.disabled' }}>
                    ({count})
                  </Box>
                )}
              </Box>
            );
          },
        },
        { field: 'common_name', headerName: 'Nombre común / morph', flex: 1, minWidth: 180, sortable: false, valueGetter: (_, row) => (row.__kind === 'morph' ? row.description ?? '—' : row.common_name ?? '—') },
        // Columnas de "Cultivos": aplican a especies y morphs (cría independiente)
        {
          field: 'units',
          headerName: 'En venta',
          width: 130,
          align: 'right',
          headerAlign: 'right',
          sortable: false,
          renderCell: (params) => (
            <Box sx={{ lineHeight: 1.4, py: 0.5, textAlign: 'right' }}>
              {rowUnits(params.row)}
              <KeptCounts kept={rowKept(params.row)} />
            </Box>
          ),
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

  // «Nuevo …» parte de donde estás: dentro de un grupo el género (o subgrupo)
  // nace en ese grupo; dentro de un género la especie nace en ese género.
  const initialFromFilter = () => {
    if (filter?.type === 'group') return { genera: { group_id: filter.id }, groups: { parent_id: filter.id } }[tabValue];
    if (filter?.type === 'genus' && tabValue === 'species') return { genus_id: filter.id };
    return undefined;
  };

  return (
    <>
      <DashboardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <CustomBreadcrumbs
          heading="Especies y morphs"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Animales', href: paths.dashboard.animal.root },
            { name: 'Especies y morphs' },
          ]}
          action={
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              {tabValue === 'groups' && can('update') && <CategoryBrowseToggle />}
              {can('create') && (
                <Button
                  variant="contained"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                  onClick={() => setDialog({ tab: tabValue, current: null, initial: initialFromFilter() })}
                >
                  {`Nuevo ${tabConfig.singular}`}
                </Button>
              )}
            </Stack>
          }
          sx={{ mb: 1.5 }}
        />
        {/* Que se sepa qué se edita aquí: lo que ve el cliente en la tienda */}
        <Typography variant="body2" sx={{ mb: { xs: 3, md: 4 }, maxWidth: 720, color: 'text.secondary' }}>
          Aquí se edita lo que la tienda muestra de cada especie y variedad: sus fotos, la
          descripción y la ficha de cuidados (temperatura, humedad, dieta…). Abre una especie con
          «Editar especie y ficha».
        </Typography>

        {tabValue === 'species' && (
          <AnimalCapAlert shown={animals.length} total={animalsTotal} sx={{ mb: 3 }} />
        )}

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
            onChange={(_, v) => goTo(v, filter)}
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
            onFilterModelChange={(model) => setSearch((model.quickFilterValues ?? []).join(' '))}
            columnVisibilityModel={columnVisibilityModel}
            onColumnVisibilityModelChange={setColumnVisibilityModel}
            pageSizeOptions={[25, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            slots={{
              noRowsOverlay: () => (
                <EmptyList
                  title={`Aquí no hay ${tabConfig.label.toLowerCase()} todavía`}
                  description="Grupo → género → especie → morph. Desde «Nueva especie» puedes crear también su género y su grupo."
                  newLabel={`Nuevo ${tabConfig.singular}`}
                  onNew={
                    can('create')
                      ? () => setDialog({ tab: tabValue, current: null, initial: initialFromFilter() })
                      : null
                  }
                />
              ),
              noResultsOverlay: () => <EmptyContent title="Sin resultados" />,
              // Todo en una línea: búsqueda + filtro activo + botones del grid
              // Componente estable (no una función nueva en cada render): si se
              // recrea, el buscador se desmonta y pierde el foco en cada letra
              toolbar: TaxonomyToolbar,
            }}
            slotProps={{
              toolbar: {
                chipLabel: filter ? filterLabel() : null,
                onClearFilter: () => goTo(tabValue, null),
                showHint: Boolean(drillDown[tabValue]),
              },
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
