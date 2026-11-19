import { useMemo, useState, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Tabs from '@mui/material/Tabs';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import Collapse from '@mui/material/Collapse';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Autocomplete from '@mui/material/Autocomplete';
import CardActionArea from '@mui/material/CardActionArea';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';
import { runInBatches } from 'src/utils/run-in-batches';

import { moduleOn } from 'src/global-config';
import { DashboardContent } from 'src/layouts/dashboard';
import {
  updateMorph,
  deleteAnimal,
  updateAnimal,
  useAllGenera,
  useAllMorphs,
  updateSpecies,
  useGetAnimals,
  useAllSpecies,
  useAnimalGroupTree,
} from 'src/actions/animal';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

import { printPriceList } from '../price-list';
import { AnimalCapAlert } from '../animal-cap-alert';
import { SaleViewSwitch } from '../sale-view-switch';
import { QrLabelsDialog } from '../qr-labels-dialog';
import { MoveAnimalMenu } from '../move-animal-dialog';
import { varietyName, VarietyPicker } from '../variety-picker';
import { DiscountPrice, BulkDiscountDialog } from '../../discount/bulk-discount-dialog';
import {
  PURPOSES,
  purposeOf,
  SEX_LABELS,
  statusLabel,
  animalUnits,
  siteBlocker,
  displayImage,
  speciesLabel,
  STATUS_COLORS,
  PURPOSE_COLORS,
  PURPOSE_LABELS,
  countByPurpose,
  isClosedStatus,
  saleFormatLabel,
  flattenGroupTree,
} from '../utils';

// ----------------------------------------------------------------------

const isBulkSpecies = (species) => !!species?.sale_format && species.sale_format !== 'individual';

// Colonia o paquete que se quedó en 0: solo se ve en «Todo», en gris
const isEmptyBulk = (animal) =>
  animal.status === 'available' && isBulkSpecies(animal.species) && Number(animal.stock) === 0;

// Por dónde se vende un ejemplar en venta: la tienda en línea (show_public)
// y la venta rápida de convenciones (quick_sale). Es un solo inventario; los
// canales solo dicen dónde se ofrece.
const onSite = (a) => a.show_public !== false;
const onQuick = (a) => Boolean(a.quick_sale);
const CHANNELS = [
  { value: '', label: 'Todos', test: () => true },
  { value: 'site', label: 'En la tienda', test: onSite },
  { value: 'quick', label: 'En la venta rápida', test: onQuick },
  { value: 'site-only', label: 'Solo tienda', test: (a) => onSite(a) && !onQuick(a) },
  { value: 'quick-only', label: 'Solo venta rápida', test: (a) => onQuick(a) && !onSite(a) },
  { value: 'none', label: 'En ninguno', test: (a) => !onSite(a) && !onQuick(a) },
];
// Cambios en bloque desde «Canales (N)»
const CHANNEL_ACTIONS = [
  { label: 'Agregar a la venta rápida', patch: { quick_sale: true } },
  { label: 'Quitar de la venta rápida', patch: { quick_sale: false } },
  { label: 'Mostrar en la tienda', patch: { show_public: true } },
  { label: 'Ocultar de la tienda', patch: { show_public: false } },
];

const isLive = (animal) => animal.status === 'available' || animal.status === 'reserved';

// Qué ejemplares entran en cada filtro. Los de área (sale, breeding, history)
// son el «Todo» de su página; una cepa o paquete en 0 solo se ve ahí, en gris.
const FILTERS = {
  sale: (a) => isLive(a) && purposeOf(a) === 'sale',
  breeding: (a) => isLive(a) && purposeOf(a) !== 'sale',
  breeder: (a) => isLive(a) && !isEmptyBulk(a) && purposeOf(a) === 'breeder',
  growing: (a) => isLive(a) && !isEmptyBulk(a) && purposeOf(a) === 'growing',
  history: (a) => a.status === 'sold' || a.status === 'deceased',
  sold: (a) => a.status === 'sold',
  deceased: (a) => a.status === 'deceased',
};

const FILTER_LABELS = { ...PURPOSE_LABELS, sold: 'Vendidos', deceased: 'Bajas' };
const FILTER_COLORS = { ...PURPOSE_COLORS, sold: 'text', deceased: 'error' };

// Las tres páginas de animales. Lo que se vende va aparte de lo que no: cada
// una trae solo lo suyo, con su propia alta.
//   tabs: filtros dentro de la página (además de «Todo»)
//   purpose: con qué destino nace un ejemplar dado de alta aquí
const AREAS = {
  sale: {
    heading: 'En venta',
    intro: 'Lo que se vende: sale en el sitio, en el punto de venta y, si lo marcas, en la venta rápida.',
    tabs: [],
    purpose: 'sale',
    path: paths.dashboard.animal.root,
    emptyTitle: 'Todavía no hay nada en venta',
    emptyText: 'Pon en venta un ejemplar, una cepa o un paquete de una especie que ya tengas registrada.',
  },
  breeding: {
    heading: 'Pie de cría y crianza',
    intro: 'Tus reproductores y las crías o cultivos que todavía no salen a la venta. Nada de aquí se vende ni se anuncia.',
    tabs: ['breeder', 'growing'],
    purpose: 'breeder',
    path: paths.dashboard.animal.breeding,
    emptyTitle: 'Todavía no hay pie de cría ni crianza',
    emptyText: 'Registra aquí tus reproductores y las crías que aún no vendes.',
  },
  history: {
    heading: 'Vendidos y bajas',
    intro: 'Historial: lo que ya se vendió y las bajas.',
    tabs: ['sold', 'deceased'],
    purpose: null,
    path: paths.dashboard.animal.history,
    emptyTitle: 'Todavía no hay vendidos ni bajas',
    emptyText: 'Aquí queda lo que se vendió y lo que causó baja.',
  },
};

function groupBySpecies(animals) {
  const map = new Map();
  animals.forEach((animal) => {
    if (!animal.species) return;
    let entry = map.get(animal.species.id);
    if (!entry) {
      entry = { species: animal.species, animals: [] };
      map.set(animal.species.id, entry);
    }
    entry.animals.push(animal);
  });
  return [...map.values()].sort((a, b) => speciesLabel(a.species).localeCompare(speciesLabel(b.species)));
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ----------------------------------------------------------------------

// Una de las tres páginas de animales (`area`: sale | breeding | history).
// Arriba los conteos; la lista agrupa por especie (como producto → lotes) y al
// expandir salen los ejemplares con «Mover a…», que es como pasan de una
// página a otra.
export function AnimalListView({ area = 'sale' }) {
  const config = AREAS[area];

  const { user } = useAuthContext();
  const canCreate = user?.permissions?.includes('animals.create');
  const canUpdate = user?.permissions?.includes('animals.update');
  const canDelete = user?.permissions?.includes('animals.delete');
  const canUpdateSpecies = user?.permissions?.includes('species.update');
  const canUpdateMorphs = user?.permissions?.includes('morphs.update');

  // El breadcrumb del detalle enlaza aquí con ?genus_id= / ?species_id=
  const [searchParams] = useSearchParams();
  const { state: navState } = useLocation();

  const [groupFilter, setGroupFilter] = useState('');
  const [genusFilter, setGenusFilter] = useState(() => Number(searchParams.get('genus_id')) || '');
  const [speciesFilter, setSpeciesFilter] = useState(() => Number(searchParams.get('species_id')) || '');
  // variedad: se filtra aquí (el API filtra por especie)
  const [morphFilter, setMorphFilter] = useState(null);
  // filtro dentro de la página; el del área es «Todo»
  const [destination, setDestination] = useState(area);
  // alta corta: null = cerrada; { species } = abierta (con o sin especie)
  // ids por borrar (selección de arriba o el botón de un bloque); null = cerrado
  const [toDelete, setToDelete] = useState(null);
  // canal (solo En venta) y el menú de cambios en bloque
  const [channel, setChannel] = useState('');
  const [channelMenu, setChannelMenu] = useState(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set()); // ids de ejemplares
  // recién dado de alta un ejemplar: su especie llega abierta
  const [expanded, setExpanded] = useState(() => new Set(navState?.expand ? [navState.expand] : []));
  const [labelsFor, setLabelsFor] = useState(null); // entry {species, animals} → diálogo de etiquetas QR

  const { genera: allGenera } = useAllGenera();
  const { species: allSpecies, speciesMutate } = useAllSpecies();
  const { morphs: allMorphs, morphsMutate } = useAllMorphs();
  const { groupTree } = useAnimalGroupTree();
  const groupsFlat = flattenGroupTree(groupTree);

  // ¿Se ve en el sitio? Se decide aquí, junto a lo que está en venta. Un
  // grupo oculto esconde todo lo de abajo (igual que el catálogo público).
  const hiddenGroups = useMemo(() => {
    const byId = Object.fromEntries(groupsFlat.map((g) => [g.id, g]));
    return new Set(
      groupsFlat
        .filter((g) => g.show_public === false || g.ancestors.some((id) => byId[id]?.show_public === false))
        .map((g) => g.id)
    );
  }, [groupsFlat]);
  const site = useMemo(
    () => ({
      species: Object.fromEntries(allSpecies.map((s) => [s.id, s])),
      morphsOf: (speciesId) =>
        allMorphs.filter((m) => m.species_id === speciesId).sort((a, b) => a.name.localeCompare(b.name)),
      hiddenGroups,
    }),
    [allSpecies, allMorphs, hiddenGroups]
  );

  // Optimista sobre la lista ({ data, total }) y luego se confirma
  const setOnSite = async (kind, id, value) => {
    const mutate = kind === 'morph' ? morphsMutate : speciesMutate;
    const write = kind === 'morph' ? updateMorph : updateSpecies;
    mutate(
      (current) =>
        current && {
          ...current,
          data: current.data.map((it) => (it.id === id ? { ...it, show_public: value } : it)),
        },
      { revalidate: false }
    );
    try {
      await write(id, { show_public: value });
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar');
    } finally {
      await mutate();
    }
  };

  const speciesOptions = genusFilter
    ? allSpecies.filter((s) => s.genus?.id === Number(genusFilter))
    : allSpecies;

  // ponytail: una sola página de 500 (máximo del backend) y agrupación en
  // memoria; paginar/agrupar en servidor cuando el criadero pase de 500
  const { animals, animalsTotal, animalsLoading, animalsError, animalsMutate } = useGetAnimals({
    page: 1,
    pageSize: 500,
    groupId: groupFilter || undefined,
    genusId: genusFilter || undefined,
    speciesId: speciesFilter || undefined,
  });

  // Tarjetas y conteos del filtro: en unidades (una colonia cuenta su stock);
  // vendidos y bajas en registros. «Todo» va sin número: mezclaría las dos cosas.
  const counts = useMemo(() => {
    const byPurpose = countByPurpose(animals);
    const sold = animals.filter((a) => a.status === 'sold').length;
    const deceased = animals.filter((a) => a.status === 'deceased').length;
    const saleAvailable = animals
      .filter((a) => a.status === 'available' && purposeOf(a) === 'sale')
      .reduce((sum, a) => sum + animalUnits(a, a.species), 0);
    return {
      ...byPurpose,
      sold,
      deceased,
      saleAvailable,
    };
  }, [animals]);

  const visible = useMemo(
    () =>
      animals
        .filter(FILTERS[destination])
        .filter((a) => !morphFilter || a.morphs?.some((m) => m.id === morphFilter))
        .filter(CHANNELS.find((c) => c.value === channel).test),
    [animals, destination, morphFilter, channel]
  );
  const grouped = useMemo(() => groupBySpecies(visible), [visible]);

  const toggleExpanded = (speciesId) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(speciesId)) next.delete(speciesId);
      else next.add(speciesId);
      return next;
    });

  // Selección para borrado en lote: alterna un ejemplar o todos los de una especie
  const toggleSelected = useCallback((ids, value) => {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (value ? next.add(id) : next.delete(id)));
      return next;
    });
  }, []);

  const canSelectAny = canDelete || (canUpdate && area === 'sale');

  // Solo cuenta lo seleccionado que sigue a la vista: al cambiar de filtro no
  // se borran ejemplares que ya no aparecen en pantalla
  const selectedVisible = useMemo(() => {
    const ids = new Set(visible.map((a) => a.id));
    return [...selected].filter((id) => ids.has(id));
  }, [visible, selected]);
  const selectableIds = useMemo(
    () => visible.filter((a) => !isClosedStatus(a.status)).map((a) => a.id),
    [visible]
  );
  const someChecked = selectableIds.some((id) => selected.has(id));
  const allChecked = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const deleteIds = toDelete ?? [];

  const handleConfirmDelete = useCallback(async () => {
    // allSettled y no all: el backend rechaza los vendidos o los que están en
    // una venta, y con `all` un rechazo escondería los que sí se borraron
    const results = await runInBatches(deleteIds, 5, (id) => deleteAnimal(id));
    const failed = results.filter((r) => r.status === 'rejected');
    const ok = results.length - failed.length;

    await animalsMutate();
    if (ok) toast.success(ok === 1 ? 'Animal eliminado' : `${ok} animales eliminados`);
    if (failed.length) {
      toast.error(
        failed.length === 1
          ? failed[0].reason?.message || 'Error al eliminar'
          : `${failed.length} no se pudieron eliminar`
      );
    }

    setSelected((prev) => new Set([...prev].filter((id) => !deleteIds.includes(id))));
    setToDelete(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toDelete, animalsMutate]);

  const applyChannel = async (patch) => {
    setChannelMenu(null);
    const ids = [...selectedVisible];
    const results = await runInBatches(ids, 5, (id) => updateAnimal(id, patch));
    const failed = results.filter((r) => r.status === 'rejected');
    await animalsMutate();
    if (failed.length) {
      toast.error(
        failed.length === 1
          ? failed[0].reason?.message || 'No se pudo cambiar'
          : `${failed.length} no se pudieron cambiar`
      );
    } else {
      toast.success(ids.length === 1 ? 'Listo' : `${ids.length} ejemplares actualizados`);
    }
  };

  // En venta no lleva contador: el conteo va en cada especie
  const renderSummary = () =>
    area === 'sale' ? null : (
      <Box
        sx={{
          gap: 2,
          mb: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
        }}
      >
        {config.tabs.map((key) => (
          <Card
            key={key}
            variant="outlined"
            sx={{ borderColor: destination === key ? `${FILTER_COLORS[key]}.main` : undefined }}
          >
            <CardActionArea onClick={() => setDestination(key)} sx={{ p: 2.5 }}>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                {FILTER_LABELS[key]}
              </Typography>
              <Typography variant="h3">{counts[key]}</Typography>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    );

  // Grupo/Género/Especie con búsqueda al teclear (ignora acentos)
  const renderFilters = () => (
    <Stack direction="row" spacing={2} sx={{ p: 2.5, flexWrap: 'wrap', gap: 2 }}>
      {area === 'sale' && (
        <TextField
          select
          size="small"
          label="Dónde se vende"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          sx={{ minWidth: 190 }}
        >
          {CHANNELS.map((c) => (
            <MenuItem key={c.value} value={c.value}>
              {c.label}
            </MenuItem>
          ))}
        </TextField>
      )}
      <Autocomplete
        size="small"
        options={groupsFlat}
        value={groupsFlat.find((g) => g.id === Number(groupFilter)) ?? null}
        onChange={(_, option) => setGroupFilter(option?.id ?? '')}
        getOptionLabel={(option) => option?.name ?? ''}
        renderOption={(props, option) => (
          <li {...props} key={option.id} style={{ ...props.style, paddingLeft: 16 + option.depth * 16 }}>
            {option.depth > 0 && '└ '}
            {option.name}
          </li>
        )}
        renderInput={(params) => <TextField {...params} label="Grupo" />}
        sx={{ minWidth: 200 }}
      />
      <Autocomplete
        size="small"
        options={allGenera}
        value={allGenera.find((g) => g.id === Number(genusFilter)) ?? null}
        onChange={(_, option) => {
          setGenusFilter(option?.id ?? '');
          setSpeciesFilter('');
          setMorphFilter(null);
        }}
        getOptionLabel={(option) => option?.name ?? ''}
        renderInput={(params) => <TextField {...params} label="Género" />}
        sx={{ minWidth: 180 }}
      />
      {/* Por nombre común, científico o de la variedad (Glacier, Papaya…) */}
      <VarietyPicker
        filter
        size="small"
        label="Especie o variedad"
        species={speciesOptions}
        value={{ speciesId: speciesFilter || null, morphIds: morphFilter ? [morphFilter] : [] }}
        onChange={(next) => {
          setSpeciesFilter(next.species?.id ?? '');
          setMorphFilter(next.morphIds[0] ?? null);
        }}
        sx={{ minWidth: 280 }}
      />
    </Stack>
  );

  const isEmpty = !animalsLoading && !grouped.length;

  return (
    <>
      <DashboardContent>
        <CustomBreadcrumbs
          heading={config.heading}
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Animales' },
            { name: config.heading },
          ]}
          action={
            <Stack direction="row" spacing={1.5}>
              {canUpdate && area === 'sale' && selectedVisible.length > 0 && (
                <>
                  <Button variant="outlined" onClick={(e) => setChannelMenu(e.currentTarget)}>
                    Canales ({selectedVisible.length})
                  </Button>
                  <Button variant="outlined" onClick={() => setDiscountOpen(true)}>
                    Descuento ({selectedVisible.length})
                  </Button>
                  <Menu
                    anchorEl={channelMenu}
                    open={Boolean(channelMenu)}
                    onClose={() => setChannelMenu(null)}
                  >
                    {CHANNEL_ACTIONS.map((action) => (
                      <MenuItem key={action.label} onClick={() => applyChannel(action.patch)}>
                        {action.label}
                      </MenuItem>
                    ))}
                  </Menu>
                </>
              )}
              {canDelete && selectedVisible.length > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
                  onClick={() => setToDelete(selectedVisible)}
                >
                  Eliminar ({selectedVisible.length})
                </Button>
              )}
              {area === 'sale' && (
                <Button
                  variant="outlined"
                  startIcon={<Iconify icon="solar:printer-minimalistic-bold" />}
                  onClick={() => printPriceList(groupBySpecies(animals))}
                >
                  Lista de precios
                </Button>
              )}
              {canCreate && area === 'sale' && (
                <Button
                  component={RouterLink}
                  href={`${paths.dashboard.animal.new}?purpose=sale`}
                  state={{ from: config.path }}
                  variant="contained"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                >
                  Nuevo ejemplar en venta
                </Button>
              )}
              {canCreate && area === 'breeding' && (
                <Button
                  component={RouterLink}
                  href={`${paths.dashboard.animal.new}?purpose=breeder`}
                  state={{ from: config.path }}
                  variant="contained"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                >
                  Registrar ejemplar
                </Button>
              )}
            </Stack>
          }
          sx={{ mb: 2 }}
        />

        <Stack
          direction="row"
          sx={{ mb: 3, gap: 2, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography variant="body2" sx={{ maxWidth: 640, color: 'text.secondary' }}>
            {config.intro}
          </Typography>
          {area === 'sale' && <SaleViewSwitch value="list" />}
        </Stack>

        <AnimalCapAlert shown={animals.length} total={animalsTotal} sx={{ mb: 3 }} />

        {renderSummary()}

        <Card>
          {config.tabs.length > 0 && (
            <Tabs
              value={destination}
              onChange={(_, value) => setDestination(value)}
              variant="scrollable"
              sx={{ px: 2.5, boxShadow: (theme) => `inset 0 -2px 0 0 ${theme.vars.palette.divider}` }}
            >
              {/* «Todo» mezclaría animales con registros: va sin número */}
              <Tab value={area} label="Todo" />
              {config.tabs.map((key) => (
                <Tab key={key} value={key} label={`${FILTER_LABELS[key]} (${counts[key]})`} />
              ))}
            </Tabs>
          )}

          {renderFilters()}

          {isEmpty ? (
            animalsError ? (
              <EmptyContent
                title="No se pudieron cargar los animales"
                description={animalsError.message}
                sx={{ py: 10 }}
              />
            ) : groupFilter || genusFilter || speciesFilter || morphFilter || destination !== area ? (
              <EmptyContent title="Sin animales con esos filtros" sx={{ py: 10 }} />
            ) : (
              <EmptyContent
                title={config.emptyTitle}
                description={config.emptyText}
                action={
                  canCreate && area === 'sale' ? (
                    <Button
                      component={RouterLink}
                      href={`${paths.dashboard.animal.new}?purpose=sale`}
                      variant="contained"
                      sx={{ mt: 3 }}
                    >
                      Nuevo ejemplar en venta
                    </Button>
                  ) : null
                }
                sx={{ py: 10 }}
              />
            )
          ) : (
            <Scrollbar>
              <TableContainer sx={{ minWidth: 720 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 48, pr: 0 }}>
                        {/* todo lo que está a la vista (vendidos y muertos no) */}
                        {canSelectAny && (
                          <Checkbox
                            size="small"
                            disabled={!selectableIds.length}
                            checked={allChecked}
                            indeterminate={someChecked && !allChecked}
                            onChange={() => toggleSelected(selectableIds, !allChecked)}
                            slotProps={{ input: { 'aria-label': 'Seleccionar todo' } }}
                          />
                        )}
                      </TableCell>
                      <TableCell>Especie</TableCell>
                      <TableCell>Grupo</TableCell>
                      <TableCell>Cantidad</TableCell>
                      <TableCell>Precio</TableCell>
                      <TableCell>Formato</TableCell>
                      {area === 'sale' && <TableCell align="center">En el sitio</TableCell>}
                      <TableCell align="right"> </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {grouped.map((entry) => (
                      <SpeciesRows
                        key={entry.species.id}
                        entry={entry}
                        open={expanded.has(entry.species.id) || grouped.length === 1}
                        onToggle={() => toggleExpanded(entry.species.id)}
                        area={area}
                        site={area === 'sale' ? site : null}
                        canSite={{ species: canUpdateSpecies, morph: canUpdateMorphs }}
                        onSetOnSite={setOnSite}
                        onDeleteIds={setToDelete}
                        canCreate={canCreate}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                        canSelect={canSelectAny}
                        canUpdateSpecies={canUpdateSpecies}
                        onPrintLabels={() => setLabelsFor(entry)}
                        selected={selected}
                        onToggleSelected={toggleSelected}
                        onMoved={() => animalsMutate()}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>
          )}
        </Card>
      </DashboardContent>

      {discountOpen && (
        <BulkDiscountDialog
          open
          items={animals
            .filter((a) => selectedVisible.includes(a.id))
            .map((a) => ({
              id: a.id,
              name: [
                a.species?.common_name ?? a.species?.name,
                a.morphs?.length ? varietyName(a.morphs) : null,
                a.code,
              ]
                .filter(Boolean)
                .join(' · '),
              price: a.price,
              compare_at_price: a.compare_at_price,
            }))}
          onSave={(item, patch) => updateAnimal(item.id, patch)}
          onDone={() => {
            animalsMutate();
            setDiscountOpen(false);
          }}
          onClose={() => setDiscountOpen(false)}
        />
      )}

      {labelsFor && (
        <QrLabelsDialog
          species={labelsFor.species}
          animals={labelsFor.animals}
          onClose={() => setLabelsFor(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Eliminar"
        content={
          <>
            ¿Estás seguro de eliminar <strong>{deleteIds.length}</strong>{' '}
            {deleteIds.length === 1 ? 'animal' : 'animales'}?
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

// ----------------------------------------------------------------------

// «2 pie de cría», «5 en crianza», «3 en venta» (o «6 paquetes en venta (36)»)
function speciesChips(species, animals) {
  const c = countByPurpose(animals);
  const chips = PURPOSES.filter((p) => c[p]).map((p) => ({
    key: p,
    color: PURPOSE_COLORS[p],
    text:
      p === 'sale' && species.sale_format === 'package'
        ? `${plural(c.salePackages, 'paquete', 'paquetes')} en venta (${c.sale})`
        : `${c[p]} ${PURPOSE_LABELS[p].toLowerCase()}`,
  }));
  const sold = animals.filter((a) => a.status === 'sold').length;
  const deceased = animals.filter((a) => a.status === 'deceased').length;
  if (sold) chips.push({ key: 'sold', color: 'default', text: plural(sold, 'vendido', 'vendidos') });
  if (deceased) chips.push({ key: 'deceased', color: 'error', text: plural(deceased, 'baja', 'bajas') });
  // Mismo criterio que el «Pendiente» de la ficha: pide documento y no tiene folio
  const docPending = animals.filter(
    (a) => !isClosedStatus(a.status) && a.requires_legal_doc && !a.legal_doc
  ).length;
  if (docPending) {
    chips.push({
      key: 'doc',
      color: 'warning',
      text: plural(docPending, 'doc. pendiente', 'doc. pendientes'),
    });
  }
  return chips;
}

// Interruptor «En el sitio». Si un grupo o la especie lo esconden de todos
// modos, se dice por qué (el propio no basta).
function OnSiteSwitch({ name, checked, reason, disabled, onChange }) {
  const control = (
    <Switch
      size="small"
      checked={checked}
      disabled={disabled || Boolean(reason)}
      onChange={(event) => onChange(event.target.checked)}
      slotProps={{ input: { role: 'switch', 'aria-label': `En el sitio: ${name}` } }}
    />
  );
  return reason ? (
    <Tooltip title={`${reason}: se esconde aunque esté prendido`}>
      <span>{control}</span>
    </Tooltip>
  ) : (
    control
  );
}

function SpeciesRows({ entry, area, site, canSite, onSetOnSite, onDeleteIds, canSelect, open, onToggle, canCreate, canUpdate, canDelete, canUpdateSpecies, onPrintLabels, selected, onToggleSelected, onMoved }) {
  const { species, animals } = entry;
  const { pathname, search } = useLocation();

  // Vendidos y muertos no se borran: quedan fuera del "seleccionar todos"
  const deletable = animals.filter((a) => !isClosedStatus(a.status));
  const selectedHere = deletable.filter((a) => selected.has(a.id)).length;
  const allSelected = deletable.length > 0 && selectedHere === deletable.length;

  // la especie se ilustra con su propia foto; si no tiene, con la de algún ejemplar
  const photo = species.image || animals.map((a) => displayImage(a, species)).find(Boolean) || '';
  // Precio solo de los que están en venta (pie de cría y crianza no tienen)
  const prices = animals.filter((a) => purposeOf(a) === 'sale').map((a) => a.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const scientific = [species.genus?.name, species.name].filter(Boolean).join(' ');
  const format = saleFormatLabel(species);

  const isBulk = isBulkSpecies(species);
  const chips = speciesChips(species, animals);
  const speciesName = species.common_name ?? scientific;
  // sub-bloques por variedad (Nominal primero), solo si hay más de una
  const byVariety = useMemo(() => {
    const map = new Map();
    animals.forEach((a) => {
      const key = varietyName(a.morphs);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    });
    return [...map].sort(([x], [y]) => (x === 'Nominal' ? -1 : y === 'Nominal' ? 1 : x.localeCompare(y)));
  }, [animals]);
  const columns = 7 + (canSelect ? 1 : 0) + (isBulk ? 1 : 0);

  // La especie prendida no basta: la tienda solo la muestra si algún ejemplar
  // en venta está marcado (y su variedad, si tiene, también está prendida)
  const speciesOn = site?.species[species.id]?.show_public !== false;
  const groupHidden = site?.hiddenGroups.has(species.genus?.group?.id);
  const morphOn = (m) => site?.morphsOf(species.id).find((x) => x.id === m.id)?.show_public !== false;
  const noneOnSite =
    site &&
    speciesOn &&
    !groupHidden &&
    !animals.some(
      (a) =>
        purposeOf(a) === 'sale' &&
        a.status === 'available' &&
        a.show_public !== false &&
        Number(a.stock ?? 1) > 0 &&
        (a.morphs ?? []).every(morphOn)
    );

  return (
    <>
      <TableRow hover sx={{ cursor: 'pointer', '& > td': { borderBottom: 'none' } }} onClick={onToggle}>
        <TableCell sx={{ pr: 0, whiteSpace: 'nowrap' }}>
          {/* toda la especie (todas sus variedades) sin abrirla */}
          {canSelect && (
            <Checkbox
              size="small"
              disabled={!deletable.length}
              checked={allSelected}
              indeterminate={selectedHere > 0 && !allSelected}
              onClick={(event) => event.stopPropagation()}
              onChange={() => onToggleSelected(deletable.map((a) => a.id), !allSelected)}
              slotProps={{ input: { 'aria-label': `Seleccionar todo ${speciesName}` } }}
            />
          )}
          <IconButton size="small">
            <Iconify icon={open ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'} />
          </IconButton>
        </TableCell>

        <TableCell>
          <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
            <Avatar
              src={photo}
              variant="rounded"
              sx={{ width: 40, height: 40, bgcolor: 'background.neutral' }}
            >
              <Iconify icon="solar:camera-bold" width={18} />
            </Avatar>
            <Box>
              <Link
                component={RouterLink}
                href={paths.dashboard.animal.species(species.id)}
                onClick={(event) => event.stopPropagation()}
                color="inherit"
                underline="hover"
                sx={{ typography: 'subtitle2' }}
              >
                {species.common_name ?? scientific}
              </Link>
              <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic', color: 'text.secondary' }}>
                {scientific}
              </Typography>
            </Box>
          </Box>
        </TableCell>

        <TableCell>{species.genus?.group?.name ?? '—'}</TableCell>

        <TableCell>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {chips.length
              ? chips.map((chip) => (
                  <Label key={chip.key} variant="soft" color={chip.color}>
                    {chip.text}
                  </Label>
                ))
              : '—'}
          </Stack>
        </TableCell>

        <TableCell>
          {!prices.length
            ? '—'
            : minPrice === maxPrice
              ? fCurrency(minPrice)
              : `${fCurrency(minPrice)} – ${fCurrency(maxPrice)}`}
        </TableCell>

        <TableCell>{format ?? '—'}</TableCell>

        {site && (
          <TableCell align="center" onClick={(event) => event.stopPropagation()}>
            <OnSiteSwitch
              name={species.common_name ?? scientific}
              checked={speciesOn}
              reason={groupHidden ? 'Grupo oculto' : null}
              disabled={!canSite.species}
              onChange={(value) => onSetOnSite('species', species.id, value)}
            />
            {noneOnSite && (
              <Tooltip title="Prende «Mostrar en el sitio» en algún ejemplar (Editar) para que salga en la tienda">
                <Typography
                  variant="caption"
                  component="div"
                  sx={{ color: 'warning.main', lineHeight: 1.3, maxWidth: 110, mx: 'auto' }}
                >
                  No se ve: ningún ejemplar marcado
                </Typography>
              </Tooltip>
            )}
          </TableCell>
        )}

        <TableCell align="right">
          <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
            {canCreate && area !== 'history' && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<Iconify icon="mingcute:add-line" />}
                component={RouterLink}
                href={`${paths.dashboard.animal.new}?species_id=${species.id}&purpose=${area === 'sale' ? 'sale' : 'breeder'}`}
                state={{ from: `${pathname}${search}` }}
                onClick={(event) => event.stopPropagation()}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Nuevo ejemplar
              </Button>
            )}
            {canUpdateSpecies && (
              <Tooltip title="Editar especie y ficha de cuidados">
                <IconButton
                  size="small"
                  component={RouterLink}
                  href={paths.dashboard.animal.speciesEdit(species.id)}
                  state={{ from: `${pathname}${search}` }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <Iconify icon="solar:document-text-bold" width={18} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Etiquetas QR">
              <IconButton
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  onPrintLabels();
                }}
              >
                <Iconify icon="solar:printer-minimalistic-bold" width={18} />
              </IconButton>
            </Tooltip>
          </Stack>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={site ? 8 : 7} sx={{ py: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            {site && site.morphsOf(species.id).length > 0 && (
              <Stack
                direction="row"
                sx={{ mt: 1, px: 1, gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Variedades en el sitio:
                </Typography>
                {site.morphsOf(species.id).map((morph) => (
                  <Stack key={morph.id} direction="row" sx={{ alignItems: 'center' }}>
                    <OnSiteSwitch
                      name={morph.name}
                      checked={morph.show_public !== false}
                      reason={site.hiddenGroups.has(species.genus?.group?.id) ? 'Grupo oculto' : null}
                      disabled={!canSite.morph}
                      onChange={(value) => onSetOnSite('morph', morph.id, value)}
                    />
                    <Typography variant="body2">{morph.name}</Typography>
                  </Stack>
                ))}
              </Stack>
            )}
            <Box sx={{ my: 1, borderRadius: 1.5, overflow: 'hidden', bgcolor: 'background.neutral' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {canSelect && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          disabled={!deletable.length}
                          checked={allSelected}
                          indeterminate={selectedHere > 0 && !allSelected}
                          onChange={() =>
                            onToggleSelected(deletable.map((a) => a.id), !allSelected)
                          }
                        />
                      </TableCell>
                    )}
                    <TableCell>Código</TableCell>
                    <TableCell>Variedad</TableCell>
                    <TableCell>Sexo</TableCell>
                    <TableCell>{area === 'sale' ? 'Dónde se vende' : 'Destino'}</TableCell>
                    <TableCell>Estado</TableCell>
                    {isBulk && <TableCell>Cantidad</TableCell>}
                    <TableCell>Precio</TableCell>
                    <TableCell align="right"> </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {byVariety.map(([variety, list]) => {
                    const removable = list.filter((a) => !isClosedStatus(a.status));
                    return [
                      byVariety.length > 1 && (
                        <TableRow key={`h-${variety}`}>
                          <TableCell colSpan={columns} sx={{ py: 0.75, typography: 'overline', color: 'text.secondary' }}>
                            {variety} · {list.length}
                          </TableCell>
                        </TableRow>
                      ),
                      ...list.map((animal) => (
                        <CriaderoRow
                          key={animal.id}
                          animal={animal}
                          species={species}
                          showStock={isBulk}
                          canUpdate={canUpdate}
                          isSelected={selected.has(animal.id)}
                          onToggleSelect={canSelect ? onToggleSelected : undefined}
                          showChannels={area === 'sale'}
                          siteHidden={
                            site
                              ? siteBlocker({
                                  species: site.species[species.id],
                                  morphs: (animal.morphs ?? []).map(
                                    (m) => site.morphsOf(species.id).find((x) => x.id === m.id) ?? m
                                  ),
                                  groupHidden: site.hiddenGroups.has(species.genus?.group?.id),
                                })
                              : null
                          }
                          onMoved={onMoved}
                        />
                      )),
                      // fin del sub-bloque: borrar solo esta variedad
                      byVariety.length > 1 && canDelete && removable.length > 0 && (
                        <TableRow key={`d-${variety}`}>
                          <TableCell colSpan={columns} align="right" sx={{ py: 0.5 }}>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => onDeleteIds(removable.map((a) => a.id))}
                            >
                              Eliminar {variety} ({removable.length})
                            </Button>
                          </TableCell>
                        </TableRow>
                      ),
                    ];
                  })}
                </TableBody>
              </Table>
              {/* fin del bloque: borrar todo lo de esta especie que se puede borrar */}
              {canDelete && deletable.length > 0 && (
                <Stack direction="row" sx={{ px: 1, py: 0.75, justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    onClick={() => onDeleteIds(deletable.map((a) => a.id))}
                  >
                    {deletable.length === 1
                      ? `Eliminar 1 de ${speciesName}`
                      : `Eliminar los ${deletable.length} de ${speciesName}`}
                  </Button>
                </Stack>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ----------------------------------------------------------------------

// Ejemplar en «Mi criadero»: acciones con texto (Mover a…, Editar, Anotar);
// borrar va por la casilla y el botón «Eliminar (N)» de arriba
function CriaderoRow({ animal, species, showStock, showChannels, siteHidden = null, canUpdate, isSelected, onToggleSelect, onMoved }) {
  const purpose = purposeOf(animal);
  const empty = isEmptyBulk(animal);

  return (
    <TableRow hover selected={isSelected} sx={empty ? { '& td': { color: 'text.disabled' } } : undefined}>
      {onToggleSelect && (
        <TableCell padding="checkbox">
          <Checkbox
            size="small"
            checked={isSelected}
            disabled={isClosedStatus(animal.status)}
            onChange={() => onToggleSelect([animal.id], !isSelected)}
          />
        </TableCell>
      )}
      <TableCell>
        <Box sx={{ gap: 1, display: 'flex', alignItems: 'center' }}>
          <Avatar
            src={displayImage(animal, species)}
            variant="rounded"
            sx={{ width: 28, height: 28, bgcolor: 'background.default' }}
          >
            <Iconify icon="solar:camera-bold" width={14} />
          </Avatar>
          <Link
            component={RouterLink}
            href={paths.dashboard.animal.details(animal.id)}
            color="inherit"
            underline="hover"
          >
            {animal.code}
          </Link>
        </Box>
      </TableCell>
      <TableCell>{varietyName(animal.morphs)}</TableCell>
      <TableCell>{SEX_LABELS[animal.sex] ?? animal.sex}</TableCell>
      <TableCell>
        {showChannels ? (
          <Stack direction="row" spacing={0.5}>
            {/* marcado pero con su especie, variedad o grupo apagado: no sale en la tienda */}
            {onSite(animal) &&
              (siteHidden ? (
                <Label variant="soft" color="default" title={siteHidden}>
                  Tienda (no se ve)
                </Label>
              ) : (
                <Label variant="soft" color="info">
                  Tienda
                </Label>
              ))}
            {onQuick(animal) && (
              <Label variant="soft" color="secondary">
                Venta rápida
              </Label>
            )}
            {!onSite(animal) && !onQuick(animal) && '—'}
          </Stack>
        ) : (
          <Label variant="soft" color={PURPOSE_COLORS[purpose]}>
            {PURPOSE_LABELS[purpose]}
          </Label>
        )}
      </TableCell>
      <TableCell>
        <Label variant="soft" color={empty ? 'default' : (STATUS_COLORS[animal.status] ?? 'default')}>
          {statusLabel(animal) ?? animal.status}
        </Label>
      </TableCell>
      {showStock && <TableCell>{animal.stock ?? '—'}</TableCell>}
      <TableCell>
        {purpose === 'sale' ? (
          <DiscountPrice price={animal.price} compareAt={animal.compare_at_price} />
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ whiteSpace: 'nowrap' }}>
          {canUpdate && <MoveAnimalMenu animal={animal} species={species} onMoved={onMoved} />}
          {canUpdate && (
            <Button size="small" component={RouterLink} href={paths.dashboard.animal.edit(animal.id)}>
              Editar
            </Button>
          )}
          {moduleOn('bitacora') && (
            <Button
              size="small"
              component={RouterLink}
              href={`${paths.dashboard.animal.log}?species=${species.id}`}
            >
              Anotar
            </Button>
          )}
        </Stack>
      </TableCell>
    </TableRow>
  );
}

// ----------------------------------------------------------------------

// Fila de la ficha de especie (species-detail-view). onToggleSelect es
// opcional: sin él no sale la casilla
export function AnimalRow({ animal, showStock = false, canUpdate, canDelete, onDelete, isSelected = false, onToggleSelect }) {
  const purpose = purposeOf(animal);
  const renderLegalDoc = () => {
    if (!animal.requires_legal_doc) return '—';
    if (!animal.legal_doc) {
      return (
        <Label variant="soft" color="warning">
          Pendiente
        </Label>
      );
    }
    const folio = (
      <Label variant="soft" color="success">
        {animal.legal_doc}
      </Label>
    );
    return animal.legal_doc_url ? (
      <Link href={animal.legal_doc_url} target="_blank" rel="noopener" underline="none">
        {folio}
      </Link>
    ) : (
      folio
    );
  };

  return (
    <TableRow hover selected={isSelected}>
      {onToggleSelect && (
        <TableCell padding="checkbox">
          <Checkbox
            size="small"
            checked={isSelected}
            disabled={isClosedStatus(animal.status)}
            onChange={() => onToggleSelect([animal.id], !isSelected)}
          />
        </TableCell>
      )}
      <TableCell>
        <Box sx={{ gap: 1, display: 'flex', alignItems: 'center' }}>
          <Avatar
            src={displayImage(animal)}
            variant="rounded"
            sx={{ width: 28, height: 28, bgcolor: 'background.default' }}
          >
            <Iconify icon="solar:camera-bold" width={14} />
          </Avatar>
          <Link
            component={RouterLink}
            href={paths.dashboard.animal.details(animal.id)}
            color="inherit"
            underline="hover"
          >
            {animal.code}
          </Link>
        </Box>
      </TableCell>
      <TableCell>{varietyName(animal.morphs)}</TableCell>
      <TableCell>{SEX_LABELS[animal.sex] ?? animal.sex}</TableCell>
      <TableCell>{animal.birth_date ?? '—'}</TableCell>
      <TableCell>
        <Label variant="soft" color={PURPOSE_COLORS[purpose]}>
          {PURPOSE_LABELS[purpose]}
        </Label>
      </TableCell>
      <TableCell>
        {purpose === 'sale' ? (
          <DiscountPrice price={animal.price} compareAt={animal.compare_at_price} />
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell>
        <Label variant="soft" color={STATUS_COLORS[animal.status] ?? 'default'}>
          {statusLabel(animal) ?? animal.status}
        </Label>
      </TableCell>
      {showStock && <TableCell>{animal.stock ?? '—'}</TableCell>}
      <TableCell>{renderLegalDoc()}</TableCell>
      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
        <Tooltip title="Ver detalle">
          <IconButton size="small" component={RouterLink} href={paths.dashboard.animal.details(animal.id)}>
            <Iconify icon="solar:eye-bold" width={18} />
          </IconButton>
        </Tooltip>
        {canUpdate && (
          <Tooltip title="Editar">
            <IconButton size="small" component={RouterLink} href={paths.dashboard.animal.edit(animal.id)}>
              <Iconify icon="solar:pen-bold" width={18} />
            </IconButton>
          </Tooltip>
        )}
        {canDelete && !isClosedStatus(animal.status) && (
          <Tooltip title="Eliminar">
            <IconButton size="small" color="error" onClick={() => onDelete(animal.id)}>
              <Iconify icon="solar:trash-bin-trash-bold" width={18} />
            </IconButton>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
}
