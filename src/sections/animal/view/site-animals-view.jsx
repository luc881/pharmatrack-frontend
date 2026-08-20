import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Switch from '@mui/material/Switch';
import Checkbox from '@mui/material/Checkbox';
import { Toolbar, DataGrid, gridClasses } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';

import { fCurrency } from 'src/utils/format-number';

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
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { ToolbarContainer, CustomToolbarQuickFilter } from 'src/components/custom-data-grid';

import { useAuthContext } from 'src/auth/hooks';

import { flattenGroupTree } from '../utils';

// ----------------------------------------------------------------------

// Rango de precios de los ejemplares disponibles detrás de una fila.
const priceRange = (prices) => {
  if (!prices.length) return '—';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? fCurrency(min) : `${fCurrency(min)} – ${fCurrency(max)}`;
};

// Fila 1: visibilidad. Fila 2: nivel de taxonomía (drill-down, como Taxonomía).
const TABS = [
  { value: 'online', label: 'En el sitio' },
  { value: 'offline', label: 'Fuera del sitio' },
];
const NIVELES = [
  { value: 'groups', label: 'Grupos' },
  { value: 'genera', label: 'Géneros' },
  { value: 'species', label: 'Especies' },
];
// Valores admitidos en ?tab= / ?nivel= / ?ft=: cualquier otra cosa cae al
// estado por defecto, así una URL manipulada no rompe la vista.
const TAB_VALUES = TABS.map((t) => t.value);
const NIVEL_VALUES = NIVELES.map((n) => n.value);
const FILTER_TYPES = ['group', 'genus'];

// Columnas cuyo clic controla algo propio (switch/casilla): ahí el clic no
// debe bajar de nivel. Mismo propósito que CONTROL_FIELDS en animal-taxonomy-view.jsx.
const CONTROL_FIELDS = new Set(['show_public']);

// ----------------------------------------------------------------------

export function SiteAnimalsView() {
  const { user } = useAuthContext();
  const has = (perm) => !!user?.permissions?.includes(perm);

  // Pestaña, nivel y filtro en la URL, no en useState: así "atrás" del
  // navegador y compartir el enlace conservan lo que se estaba viendo. Mismo
  // mecanismo que animal-taxonomy-view.jsx (su goTo/drillDown/filtro).
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const tab = TAB_VALUES.includes(tabParam) ? tabParam : 'online';

  const nivelParam = searchParams.get('nivel');
  const nivel = NIVEL_VALUES.includes(nivelParam) ? nivelParam : 'groups';

  // Filtro encadenado al dar clic en una fila: {type: group|genus, id}.
  const filterType = searchParams.get('ft');
  const filterIdParam = Number(searchParams.get('fid'));
  const filter =
    FILTER_TYPES.includes(filterType) && Number.isInteger(filterIdParam) && filterIdParam > 0
      ? { type: filterType, id: filterIdParam }
      : null;

  // Escribe pestaña + nivel + filtro en la URL. Cualquier clave omitida
  // conserva el valor actual (útil: cambiar de nivel sin perder el filtro).
  const goTo = ({ tab: nextTab = tab, nivel: nextNivel = nivel, filter: nextFilter = filter, replace = false } = {}) => {
    const next = new URLSearchParams();
    if (nextTab !== 'online') next.set('tab', nextTab);
    if (nextNivel !== 'groups') next.set('nivel', nextNivel);
    if (nextFilter) {
      next.set('ft', nextFilter.type);
      next.set('fid', String(nextFilter.id));
    }
    setSearchParams(next, { replace });
  };

  const { groupTree, groupTreeLoading, groupTreeMutate } = useAnimalGroupTree();
  const { genera, generaLoading } = useAllGenera();
  const { species: allSpecies, speciesLoading, speciesMutate } = useAllSpecies();
  const { morphs, morphsLoading, morphsMutate } = useAllMorphs();
  // 500: mismo límite que usa Taxonomía para traer el catálogo completo de un jalón.
  const { animals } = useGetAnimals({ page: 1, pageSize: 500 });

  // Alterna show_public de un grupo raíz. Optimista: mismo patrón que
  // handleFlag en animal-taxonomy-view.jsx. Solo los grupos raíz tienen
  // switch propio (los subgrupos heredan la cascada), así que solo hace
  // falta parchear el nivel superior del árbol.
  const handleGroupFlag = async (row, value) => {
    groupTreeMutate(
      (current) => (current ?? []).map((node) => (node.id === row.id ? { ...node, show_public: value } : node)),
      { revalidate: false }
    );
    try {
      await updateAnimalGroup(row.id, { show_public: value });
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar');
    } finally {
      await groupTreeMutate();
    }
  };

  // Alterna show_public de una especie o morph. Mismo patrón optimista,
  // aplicado a la lista paginada ({ data, total }) que devuelven estos hooks.
  const handleRowFlag = async (row, value) => {
    const isMorph = row.__kind === 'morph';
    const write = isMorph ? updateMorph : updateSpecies;
    const mutate = isMorph ? morphsMutate : speciesMutate;

    mutate(
      (current) =>
        current && {
          ...current,
          data: current.data.map((it) => (it.id === row.id ? { ...it, show_public: value } : it)),
        },
      { revalidate: false }
    );
    try {
      await write(row.id, { show_public: value });
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar');
    } finally {
      await mutate();
    }
  };

  // IDs de morphs ocultos: un ejemplar que lleve cualquiera de estos no se ve
  // en el sitio en NINGUNA de sus tarjetas (ni especie ni morph), aunque
  // lleve otro morph visible. Replica la condición 4 del backend.
  const hiddenMorphIds = useMemo(
    () => new Set(morphs.filter((m) => m.show_public === false).map((m) => m.id)),
    [morphs]
  );
  // Un ejemplar con cualquier morph oculto no aparece en el sitio en NINGUNA
  // tarjeta (ni especie ni morph). Único punto que decide eso: conteos y
  // precios lo reusan para no poder corregir uno y olvidar el otro.
  const isHiddenByMorph = useCallback(
    (a) => (a.morphs ?? []).some((m) => hiddenMorphIds.has(m.id)),
    [hiddenMorphIds]
  );

  // Unidades disponibles y rango de precio, por especie y por morph. Un
  // animal puede tener varios morphs: suma/agrega a cada uno de los suyos.
  // Descuenta los ejemplares con algún morph oculto: el sitio no los muestra
  // en ninguna tarjeta, así que tampoco deben sumar aquí (no es un descuido).
  const availableBySpecies = useMemo(() => {
    const map = {};
    animals.forEach((a) => {
      if (a.status !== 'available' || !a.species_id || isHiddenByMorph(a)) return;
      map[a.species_id] = (map[a.species_id] ?? 0) + (a.stock ?? 1);
    });
    return map;
  }, [animals, isHiddenByMorph]);

  const availableByMorph = useMemo(() => {
    const map = {};
    animals.forEach((a) => {
      if (a.status !== 'available' || isHiddenByMorph(a)) return;
      (a.morphs ?? []).forEach((m) => {
        map[m.id] = (map[m.id] ?? 0) + (a.stock ?? 1);
      });
    });
    return map;
  }, [animals, isHiddenByMorph]);

  const pricesBySpecies = useMemo(() => {
    const map = {};
    animals.forEach((a) => {
      if (a.status !== 'available' || !a.species_id || !a.price || isHiddenByMorph(a)) return;
      (map[a.species_id] ??= []).push(a.price);
    });
    return map;
  }, [animals, isHiddenByMorph]);

  const pricesByMorph = useMemo(() => {
    const map = {};
    animals.forEach((a) => {
      if (a.status !== 'available' || !a.price || isHiddenByMorph(a)) return;
      (a.morphs ?? []).forEach((m) => {
        (map[m.id] ??= []).push(a.price);
      });
    });
    return map;
  }, [animals, isHiddenByMorph]);

  const rowUnits = (row) => (row.__kind === 'morph' ? availableByMorph[row.id] : availableBySpecies[row.id]) ?? 0;
  const rowPrices = (row) => (row.__kind === 'morph' ? pricesByMorph[row.id] : pricesBySpecies[row.id]) ?? [];

  // AnimalGroup es una jerarquía libre (parent_id anidable a cualquier
  // profundidad) y los géneros cuelgan de cualquier nivel, no solo de la
  // raíz — de hecho hoy ningún género cuelga directo de un grupo raíz. El
  // backend oculta un grupo Y TODO SU SUBÁRBOL, así que "oculto" se decide
  // recorriendo ancestros, nunca mirando el show_public del grupo inmediato
  // (genus.group) solo. No lo simplifiques de vuelta a eso.
  const groupsFlat = useMemo(() => flattenGroupTree(groupTree), [groupTree]);
  const groupsById = useMemo(() => Object.fromEntries(groupsFlat.map((g) => [g.id, g])), [groupsFlat]);
  const hiddenGroupIds = useMemo(() => {
    const hidden = new Set();
    groupsFlat.forEach((g) => {
      const cascaded = g.show_public === false || g.ancestors.some((id) => groupsById[id]?.show_public === false);
      if (cascaded) hidden.add(g.id);
    });
    return hidden;
  }, [groupsFlat, groupsById]);
  // Grupo raíz (el ancestro más alto) del grupo inmediato de un género.
  const rootGroupOf = (groupId) => {
    const g = groupsById[groupId];
    if (!g) return null;
    return groupsById[g.ancestors[0] ?? g.id] ?? null;
  };

  // IDs del grupo elegido en el filtro + todo su subárbol (mismo cálculo que
  // groupIdSet en animal-taxonomy-view.jsx: `ancestors` va raíz → abajo, así
  // que un descendiente siempre lo incluye).
  const groupIdSet =
    filter?.type === 'group'
      ? new Set([filter.id, ...groupsFlat.filter((g) => g.ancestors.includes(filter.id)).map((g) => g.id)])
      : null;

  const speciesById = useMemo(() => Object.fromEntries(allSpecies.map((s) => [s.id, s])), [allSpecies]);
  // La especie de una fila (ella misma, o la que le corresponde a un morph):
  // de ahí cuelgan el género y el grupo raíz que deciden si se ve o no.
  const rowSpecies = (row) => (row.__kind === 'morph' ? speciesById[row.__speciesId] : row);

  // Especies con sus morphs anidados debajo. A diferencia de la pestaña
  // Especies de Taxonomía, aquí no se pliegan: esta pantalla existe para
  // auditar de un vistazo, incluidos los morphs.
  // ponytail: sin colapso; si el catálogo crece mucho, copiar el acordeón de
  // animal-taxonomy-view.jsx.
  const morphsBySpecies = useMemo(() => {
    const map = {};
    morphs.forEach((m) => {
      (map[m.species_id] ??= []).push(m);
    });
    return map;
  }, [morphs]);

  // Motivo por el que una fila (especie o morph) no se ve en el sitio, en
  // orden de precedencia. Si ninguno aplica, la fila se ve (celda vacía) —
  // incluido el caso en que su propio switch está apagado: eso ya lo dice el
  // switch, no hace falta repetirlo aquí. ÚNICA fuente de verdad de "¿esto
  // se ve?" para especies/morphs: la fila 1 (tab) y el switch deshabilitado
  // la reusan en vez de reimplementarla — divergir de esto ya causó tres bugs.
  const statusReason = (row) => {
    const sp = rowSpecies(row);
    const groupId = sp?.genus?.group?.id;
    if (groupId != null && hiddenGroupIds.has(groupId)) return 'Grupo oculto';
    if (row.__kind === 'morph' && sp?.show_public === false) return 'Especie oculta';
    if (row.show_public !== false && rowUnits(row) === 0) return 'Sin ejemplares disponibles';
    return null;
  };

  // Un género no se ve en el sitio si el grupo del que cuelga (a cualquier
  // profundidad) está oculto. Mismo hiddenGroupIds que arriba, ninguna regla nueva.
  const genusHidden = (g) => hiddenGroupIds.has(g.group?.id);

  // Clic en una fila baja un nivel: grupo → géneros, género → especies.
  // Especies no baja más: sus morphs ya se ven anidados en la misma tabla.
  const drillDown = {
    groups: (row) => ({ next: 'genera', filter: { type: 'group', id: row.id } }),
    genera: (row) => ({ next: 'species', filter: { type: 'genus', id: row.id } }),
  };

  const handleCellClick = (params) => {
    if (CONTROL_FIELDS.has(params.field) || !drillDown[nivel]) return;
    const { next, filter: nextFilter } = drillDown[nivel](params.row);
    goTo({ nivel: next, filter: nextFilter });
  };

  // Etiqueta del chip del filtro activo, derivada de los datos ya cargados
  // (la URL solo guarda tipo + id).
  const filterLabel = () => {
    if (!filter) return null;
    if (filter.type === 'group') return `Grupo: ${groupsById[filter.id]?.name ?? '…'}`;
    return `Género: ${genera.find((g) => g.id === filter.id)?.name ?? '…'}`;
  };

  // ----------------------------------------------------------------------
  // Filas + columnas por nivel. La fila 1 (tab) filtra con el mismo criterio
  // que ya existe para cada nivel, nunca con una regla nueva.

  const groupsColumns = [
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
      headerName: 'En el sitio',
      width: 120,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) =>
        // La visibilidad se controla por grupo raíz: ocultar uno esconde todo
        // su subárbol, así que en los hijos no hay nada que marcar.
        params.row.depth === 0 ? (
          <Checkbox
            checked={params.row.show_public !== false}
            disabled={!has('animalgroups.update')}
            title={has('animalgroups.update') ? undefined : 'Requiere el permiso animalgroups.update'}
            onChange={(e) => handleGroupFlag(params.row, e.target.checked)}
          />
        ) : (
          <Box sx={{ color: 'text.disabled' }}>—</Box>
        ),
    },
  ];

  const generaColumns = [
    { field: 'name', headerName: 'Nombre', flex: 1, minWidth: 200 },
    { field: 'group', headerName: 'Grupo', flex: 1, minWidth: 160, valueGetter: (v) => v?.name ?? '—' },
  ];

  const speciesColumns = [
    {
      field: 'name',
      headerName: 'Nombre',
      flex: 1,
      minWidth: 220,
      sortable: false,
      renderCell: (params) =>
        params.row.__kind === 'morph' ? <Box sx={{ pl: 3 }}>└ {params.row.name}</Box> : params.row.name,
    },
    {
      field: 'root_group',
      headerName: 'Grupo raíz',
      width: 160,
      sortable: false,
      valueGetter: (_, row) => rootGroupOf(rowSpecies(row)?.genus?.group?.id)?.name ?? '—',
    },
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
      field: 'price',
      headerName: 'Precio',
      width: 160,
      sortable: false,
      renderCell: (params) => priceRange(rowPrices(params.row)),
    },
    {
      field: 'show_public',
      headerName: 'En el sitio',
      width: 120,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const { row } = params;
        const perm = row.__kind === 'morph' ? 'morphs.update' : 'species.update';
        const canWrite = has(perm);
        // El grupo manda por encima en la cascada de visibilidad: si está
        // oculto, encender el switch de la especie/morph no la haría
        // aparecer en el sitio. Se deshabilita también en ese caso — se suma
        // a (no reemplaza) la falta de permiso, y el title dice cuál aplica.
        const sp = rowSpecies(row);
        const groupId = sp?.genus?.group?.id;
        const groupHidden = groupId != null && hiddenGroupIds.has(groupId);
        const disabled = !canWrite || groupHidden;
        const title = !canWrite
          ? `Requiere el permiso ${perm}`
          : groupHidden
            ? 'El grupo está oculto: enciéndelo primero'
            : undefined;
        return (
          <Switch
            checked={row.show_public !== false}
            disabled={disabled}
            title={title}
            onChange={(e) => handleRowFlag(row, e.target.checked)}
          />
        );
      },
    },
    {
      field: 'status',
      headerName: 'Estado',
      width: 200,
      sortable: false,
      renderCell: (params) => {
        const reason = statusReason(params.row);
        return reason ? <Label color="warning">{reason}</Label> : null;
      },
    },
  ];

  const gridProps = {
    groups: {
      rows: groupsFlat
        .filter((g) => !groupIdSet || groupIdSet.has(g.id))
        .filter((g) => (tab === 'online' ? !hiddenGroupIds.has(g.id) : hiddenGroupIds.has(g.id))),
      loading: groupTreeLoading,
      columns: groupsColumns,
    },
    genera: {
      rows: genera
        .filter((g) => {
          if (!filter) return true;
          if (filter.type === 'group') return groupIdSet.has(g.group?.id);
          return g.id === filter.id;
        })
        .filter((g) => (tab === 'online' ? !genusHidden(g) : genusHidden(g))),
      loading: generaLoading || groupTreeLoading,
      columns: generaColumns,
    },
    species: {
      rows: (() => {
        const rows = [];
        allSpecies.forEach((sp) => {
          if (filter) {
            if (filter.type === 'group' && !groupIdSet.has(sp.genus?.group?.id)) return;
            if (filter.type === 'genus' && sp.genus_id !== filter.id) return;
          }

          const speciesRow = { ...sp, _rowId: `s${sp.id}`, __kind: 'species', depth: 0 };
          const visible = !statusReason(speciesRow);
          if (tab === 'online' ? !visible : visible) return;

          rows.push(speciesRow);
          (morphsBySpecies[sp.id] ?? []).forEach((m) =>
            rows.push({ ...m, _rowId: `m${m.id}`, __kind: 'morph', depth: 1, __speciesId: sp.id })
          );
        });
        return rows;
      })(),
      loading: groupTreeLoading || speciesLoading || morphsLoading,
      columns: speciesColumns,
    },
  }[nivel];

  return (
    <DashboardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
      <CustomBreadcrumbs
        heading="Animales del sitio"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Sitio web' },
          { name: 'Animales' },
        ]}
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
          value={tab}
          onChange={(_, value) => goTo({ tab: value })}
          sx={{ px: 2.5, boxShadow: (t) => `inset 0 -2px 0 0 ${t.vars.palette.divider}` }}
        >
          {TABS.map((t) => (
            <Tab key={t.value} value={t.value} label={t.label} />
          ))}
        </Tabs>

        <Tabs
          value={nivel}
          onChange={(_, value) => goTo({ nivel: value })}
          sx={{ px: 2.5, boxShadow: (t) => `inset 0 -2px 0 0 ${t.vars.palette.divider}` }}
        >
          {NIVELES.map((n) => (
            <Tab key={n.value} value={n.value} label={n.label} />
          ))}
        </Tabs>

        <DataGrid
          disableRowSelectionOnClick
          ignoreDiacritics
          rows={gridProps.rows}
          columns={gridProps.columns}
          getRowId={(row) => row._rowId ?? row.id}
          loading={gridProps.loading}
          onCellClick={handleCellClick}
          // 100 por defecto: paginar más bajo partiría el bloque de una especie
          // de sus morphs entre dos páginas (misma cota que ALL en actions/animal.js).
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 100 } } }}
          slots={{
            noRowsOverlay: () => <EmptyContent />,
            noResultsOverlay: () => <EmptyContent title="Sin resultados" />,
            toolbar: () => (
              <Toolbar>
                <ToolbarContainer>
                  <CustomToolbarQuickFilter />
                  {filter && (
                    <Chip color="primary" variant="soft" label={filterLabel()} onDelete={() => goTo({ filter: null })} />
                  )}
                </ToolbarContainer>
              </Toolbar>
            ),
          }}
          sx={{
            [`& .${gridClasses.cell}`]: { display: 'flex', alignItems: 'center' },
            ...(drillDown[nivel] && { [`& .${gridClasses.row}`]: { cursor: 'pointer' } }),
          }}
        />
      </Card>
    </DashboardContent>
  );
}
