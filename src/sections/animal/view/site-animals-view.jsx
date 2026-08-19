import { useMemo } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import { Toolbar, DataGrid, gridClasses } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';

import { fCurrency } from 'src/utils/format-number';

import { DashboardContent } from 'src/layouts/dashboard';
import {
  updateMorph,
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

// ----------------------------------------------------------------------

// Rango de precios de los ejemplares disponibles detrás de una fila.
const priceRange = (prices) => {
  if (!prices.length) return '—';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? fCurrency(min) : `${fCurrency(min)} – ${fCurrency(max)}`;
};

// ----------------------------------------------------------------------

export function SiteAnimalsView() {
  const { user } = useAuthContext();
  const has = (perm) => !!user?.permissions?.includes(perm);

  const { groupTree, groupTreeLoading, groupTreeMutate } = useAnimalGroupTree();
  const { species: allSpecies, speciesLoading, speciesMutate } = useAllSpecies();
  const { morphs, morphsLoading, morphsMutate } = useAllMorphs();
  // 500: mismo límite que usa Taxonomía para traer el catálogo completo de un jalón.
  const { animals } = useGetAnimals({ page: 1, pageSize: 500 });

  // Alterna show_public de un grupo raíz. Optimista: mismo patrón que
  // handleFlag en animal-taxonomy-view.jsx, pero sin recorrer subárbol —
  // el panel solo lista grupos raíz, no hay hijos que parchear.
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

  // Unidades disponibles y rango de precio, por especie y por morph. Un
  // animal puede tener varios morphs: suma/agrega a cada uno de los suyos.
  const availableBySpecies = useMemo(() => {
    const map = {};
    animals.forEach((a) => {
      if (a.status !== 'available' || !a.species_id) return;
      map[a.species_id] = (map[a.species_id] ?? 0) + (a.stock ?? 1);
    });
    return map;
  }, [animals]);

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

  const pricesBySpecies = useMemo(() => {
    const map = {};
    animals.forEach((a) => {
      if (a.status !== 'available' || !a.species_id || !a.price) return;
      (map[a.species_id] ??= []).push(a.price);
    });
    return map;
  }, [animals]);

  const pricesByMorph = useMemo(() => {
    const map = {};
    animals.forEach((a) => {
      if (a.status !== 'available' || !a.price) return;
      (a.morphs ?? []).forEach((m) => {
        (map[m.id] ??= []).push(a.price);
      });
    });
    return map;
  }, [animals]);

  const rowUnits = (row) => (row.__kind === 'morph' ? availableByMorph[row.id] : availableBySpecies[row.id]) ?? 0;
  const rowPrices = (row) => (row.__kind === 'morph' ? pricesByMorph[row.id] : pricesBySpecies[row.id]) ?? [];

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

  const rows = useMemo(() => {
    const list = [];
    allSpecies.forEach((sp) => {
      list.push({ ...sp, _rowId: `s${sp.id}`, __kind: 'species', depth: 0 });
      (morphsBySpecies[sp.id] ?? []).forEach((m) =>
        list.push({ ...m, _rowId: `m${m.id}`, __kind: 'morph', depth: 1, __speciesId: sp.id })
      );
    });
    return list;
  }, [allSpecies, morphsBySpecies]);

  // Motivo por el que una fila no se ve en el sitio, en orden de precedencia.
  // Si ninguno aplica, la fila se ve (celda vacía) — incluido el caso en que
  // su propio switch está apagado: eso ya lo dice el switch, no hace falta
  // repetirlo aquí.
  const statusReason = (row) => {
    const sp = rowSpecies(row);
    if (sp?.genus?.group?.show_public === false) return 'Grupo oculto';
    if (row.__kind === 'morph' && sp?.show_public === false) return 'Especie oculta';
    if (row.show_public !== false && rowUnits(row) === 0) return 'Sin ejemplares disponibles';
    return null;
  };

  const columns = [
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
      valueGetter: (_, row) => rowSpecies(row)?.genus?.group?.name ?? '—',
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
        return (
          <Switch
            checked={row.show_public !== false}
            disabled={!canWrite}
            title={canWrite ? undefined : `Requiere el permiso ${perm}`}
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

      <Card sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 2 }}>
          Grupos raíz
        </Typography>
        <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
          {groupTree.map((group) => (
            <FormControlLabel
              key={group.id}
              label={group.name}
              title={has('animalgroups.update') ? undefined : 'Requiere el permiso animalgroups.update'}
              control={
                <Switch
                  checked={group.show_public !== false}
                  disabled={!has('animalgroups.update')}
                  onChange={(e) => handleGroupFlag(group, e.target.checked)}
                />
              }
            />
          ))}
        </Stack>
      </Card>

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
          ignoreDiacritics
          rows={rows}
          columns={columns}
          getRowId={(row) => row._rowId}
          loading={groupTreeLoading || speciesLoading || morphsLoading}
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          slots={{
            noRowsOverlay: () => <EmptyContent />,
            noResultsOverlay: () => <EmptyContent title="Sin resultados" />,
            toolbar: () => (
              <Toolbar>
                <ToolbarContainer>
                  <CustomToolbarQuickFilter />
                </ToolbarContainer>
              </Toolbar>
            ),
          }}
          sx={{ [`& .${gridClasses.cell}`]: { display: 'flex', alignItems: 'center' } }}
        />
      </Card>
    </DashboardContent>
  );
}
