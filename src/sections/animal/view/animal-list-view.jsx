import { useBoolean } from 'minimal-shared/hooks';
import { useMemo, useState, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
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

import { DashboardContent } from 'src/layouts/dashboard';
import { deleteAnimal, useAllGenera, useGetAnimals, useAllSpecies, useAnimalGroupTree } from 'src/actions/animal';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { EmptyList, EmptyContent } from 'src/components/empty-content';

import { useAuthContext } from 'src/auth/hooks';

import { AnimalCapAlert } from '../animal-cap-alert';
import { QrLabelsDialog } from '../qr-labels-dialog';
import { MoveAnimalMenu } from '../move-animal-dialog';
import {
  PURPOSES,
  purposeOf,
  SEX_LABELS,
  statusLabel,
  animalUnits,
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

// Filtro por destino: los de venta/cría/crianza entre los vivos; vendidos y
// bajas por estado
const DESTINATIONS = [
  { value: 'all', label: 'Todo' },
  ...PURPOSES.map((p) => ({ value: p, label: PURPOSE_LABELS[p] })),
  { value: 'sold', label: 'Vendidos' },
  { value: 'deceased', label: 'Bajas' },
];

const isBulkSpecies = (species) => !!species?.sale_format && species.sale_format !== 'individual';

// Colonia o paquete que se quedó en 0: solo se ve en «Todo», en gris
const isEmptyBulk = (animal) =>
  animal.status === 'available' && isBulkSpecies(animal.species) && Number(animal.stock) === 0;

function matchesDestination(animal, destination) {
  if (destination === 'all') return true;
  if (destination === 'sold' || destination === 'deceased') return animal.status === destination;
  const live = animal.status === 'available' || animal.status === 'reserved';
  return live && !isEmptyBulk(animal) && purposeOf(animal) === destination;
}

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

// Como Promise.allSettled, pero de `size` en `size` para no saturar la API
// ponytail: tandas fijas (no un pool que rellena huecos); basta para decenas
async function runInBatches(items, size, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.allSettled(items.slice(i, i + size).map(fn))));
  }
  return results;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ----------------------------------------------------------------------

// Lista de precios imprimible para la mesa de una convención
function printPriceList(grouped) {
  const rows = grouped
    .map((entry) => {
      const { species, animals } = entry;
      const sci = [species.genus?.name, species.name].filter(Boolean).join(' ');
      const available = animals.filter(
        (a) => a.status === 'available' && purposeOf(a) === 'sale' && !isEmptyBulk(a)
      );
      if (!available.length) return null;
      const units = available.reduce((sum, a) => sum + (a.stock ?? 1), 0);
      const tiers = species.price_tiers ?? [];
      const prices = available.map((a) => Number(a.price));
      const price = tiers.length
        ? tiers.map((t) => `${t.quantity} × $${Number(t.price).toLocaleString()}`).join('  ·  ')
        : (() => {
            const min = Math.min(...prices);
            const max = Math.max(...prices);
            return min === max
              ? `$${min.toLocaleString()}`
              : `$${min.toLocaleString()} – $${max.toLocaleString()}`;
          })();
      return `<tr>
        <td><strong>${species.common_name ?? sci}</strong><br/><em>${sci}</em></td>
        <td>${saleFormatLabel(species) ?? 'Individual'}</td>
        <td>${units}</td>
        <td>${price}</td>
      </tr>`;
    })
    .filter(Boolean)
    .join('');

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>Lista de precios</title><style>
    body { font-family: Arial, sans-serif; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    p { color: #666; font-size: 12px; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px 10px; border-bottom: 1px solid #ddd; text-align: left; }
    th { background: #f4f6f8; text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; }
    em { color: #666; font-size: 11px; }
  </style></head><body>
    <h1>Lista de precios</h1>
    <p>${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })} — solo disponibles</p>
    <table><thead><tr><th>Especie</th><th>Formato</th><th>Disp.</th><th>Precio</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 300);
}

// «Mi criadero»: arriba cuántos hay en venta, pie de cría y en crianza; la
// lista agrupa por especie (como producto → lotes) con un chip por destino y
// al expandir salen los ejemplares con «Mover a…».
export function AnimalListView() {
  const confirmDialog = useBoolean();

  const { user } = useAuthContext();
  const canCreate = user?.permissions?.includes('animals.create');
  const canUpdate = user?.permissions?.includes('animals.update');
  const canDelete = user?.permissions?.includes('animals.delete');
  const canUpdateSpecies = user?.permissions?.includes('species.update');

  // El breadcrumb del detalle enlaza aquí con ?genus_id= / ?species_id=
  const [searchParams] = useSearchParams();
  const { state: navState } = useLocation();

  const [groupFilter, setGroupFilter] = useState('');
  const [genusFilter, setGenusFilter] = useState(() => Number(searchParams.get('genus_id')) || '');
  const [speciesFilter, setSpeciesFilter] = useState(() => Number(searchParams.get('species_id')) || '');
  const [destination, setDestination] = useState('all');
  const [selected, setSelected] = useState(() => new Set()); // ids de ejemplares
  // recién dado de alta un ejemplar: su especie llega abierta
  const [expanded, setExpanded] = useState(() => new Set(navState?.expand ? [navState.expand] : []));
  const [labelsFor, setLabelsFor] = useState(null); // entry {species, animals} → diálogo de etiquetas QR

  const { genera: allGenera } = useAllGenera();
  const { species: allSpecies } = useAllSpecies();
  const { groupTree } = useAnimalGroupTree();
  const groupsFlat = flattenGroupTree(groupTree);

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
    () => animals.filter((a) => matchesDestination(a, destination)),
    [animals, destination]
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

  // Solo cuenta lo seleccionado que sigue a la vista: al cambiar de filtro no
  // se borran ejemplares que ya no aparecen en pantalla
  const selectedVisible = useMemo(() => {
    const ids = new Set(visible.map((a) => a.id));
    return [...selected].filter((id) => ids.has(id));
  }, [visible, selected]);

  const deleteIds = selectedVisible;

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

    setSelected(new Set());
    confirmDialog.onFalse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVisible, animalsMutate, confirmDialog]);

  const renderSummary = () => (
    <Box
      sx={{
        gap: 2,
        mb: 3,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
      }}
    >
      {PURPOSES.map((p) => (
        <Card
          key={p}
          variant="outlined"
          sx={{ borderColor: destination === p ? `${PURPOSE_COLORS[p]}.main` : undefined }}
        >
          <CardActionArea onClick={() => setDestination(p)} sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
              {PURPOSE_LABELS[p]}
            </Typography>
            <Typography variant="h3">{counts[p]}</Typography>
            {p === 'sale' && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {`${plural(counts.saleAvailable, 'disponible', 'disponibles')} · ${plural(counts.reserved, 'apartado', 'apartados')}`}
              </Typography>
            )}
          </CardActionArea>
        </Card>
      ))}
    </Box>
  );

  // Grupo/Género/Especie con búsqueda al teclear (ignora acentos)
  const renderFilters = () => (
    <Stack direction="row" spacing={2} sx={{ p: 2.5, flexWrap: 'wrap', gap: 2 }}>
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
        }}
        getOptionLabel={(option) => option?.name ?? ''}
        renderInput={(params) => <TextField {...params} label="Género" />}
        sx={{ minWidth: 180 }}
      />
      <Autocomplete
        size="small"
        options={speciesOptions}
        value={speciesOptions.find((s) => s.id === Number(speciesFilter)) ?? null}
        onChange={(_, option) => setSpeciesFilter(option?.id ?? '')}
        getOptionLabel={(option) => speciesLabel(option)}
        renderInput={(params) => <TextField {...params} label="Especie" />}
        sx={{ minWidth: 240 }}
      />
    </Stack>
  );

  const isEmpty = !animalsLoading && !grouped.length;

  return (
    <>
      <DashboardContent>
        <CustomBreadcrumbs
          heading="Mi criadero"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Mi criadero' },
          ]}
          action={
            <Stack direction="row" spacing={1.5}>
              {canDelete && selectedVisible.length > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
                  onClick={confirmDialog.onTrue}
                >
                  Eliminar ({selectedVisible.length})
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<Iconify icon="solar:printer-minimalistic-bold" />}
                onClick={() => printPriceList(groupBySpecies(animals))}
              >
                Lista de precios
              </Button>
              {canCreate && (
                <Button
                  component={RouterLink}
                  href={paths.dashboard.animal.new}
                  variant="contained"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                >
                  Nuevo animal
                </Button>
              )}
            </Stack>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <AnimalCapAlert shown={animals.length} total={animalsTotal} sx={{ mb: 3 }} />

        {renderSummary()}

        <Card>
          <Tabs
            value={destination}
            onChange={(_, value) => setDestination(value)}
            variant="scrollable"
            sx={{ px: 2.5, boxShadow: (theme) => `inset 0 -2px 0 0 ${theme.vars.palette.divider}` }}
          >
            {DESTINATIONS.map((d) => (
              <Tab
                key={d.value}
                value={d.value}
                label={d.value === 'all' ? d.label : `${d.label} (${counts[d.value]})`}
              />
            ))}
          </Tabs>

          {renderFilters()}

          {isEmpty ? (
            animalsError ? (
              <EmptyContent
                title="No se pudieron cargar los animales"
                description={animalsError.message}
                sx={{ py: 10 }}
              />
            ) : groupFilter || genusFilter || speciesFilter || destination !== 'all' ? (
              <EmptyContent title="Sin animales con esos filtros" sx={{ py: 10 }} />
            ) : (
              <EmptyList
                title="Todavía no hay animales"
                description="Cada ejemplar (o lote de crías) que tienes para vender o en cría, con su especie, morph y precio."
                newLabel="Nuevo animal"
                href={canCreate ? paths.dashboard.animal.new : null}
                sx={{ py: 10 }}
              />
            )
          ) : (
            <Scrollbar>
              <TableContainer sx={{ minWidth: 720 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 48 }} />
                      <TableCell>Especie</TableCell>
                      <TableCell>Grupo</TableCell>
                      <TableCell>Cantidad</TableCell>
                      <TableCell>Precio</TableCell>
                      <TableCell>Formato</TableCell>
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
                        canCreate={canCreate}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
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

      {labelsFor && (
        <QrLabelsDialog
          species={labelsFor.species}
          animals={labelsFor.animals}
          onClose={() => setLabelsFor(null)}
        />
      )}

      <ConfirmDialog
        open={confirmDialog.value}
        onClose={confirmDialog.onFalse}
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

function SpeciesRows({ entry, open, onToggle, canCreate, canUpdate, canDelete, canUpdateSpecies, onPrintLabels, selected, onToggleSelected, onMoved }) {
  const { species, animals } = entry;
  const { pathname, search } = useLocation();

  // Vendidos y muertos no se borran: quedan fuera del "seleccionar todos"
  const deletable = animals.filter((a) => !isClosedStatus(a.status));
  const selectedHere = deletable.filter((a) => selected.has(a.id)).length;
  const allSelected = deletable.length > 0 && selectedHere === deletable.length;

  const photo = animals.find((a) => a.image || a.photos?.[0]);
  // Precio solo de los que están en venta (pie de cría y crianza no tienen)
  const prices = animals.filter((a) => purposeOf(a) === 'sale').map((a) => a.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const scientific = [species.genus?.name, species.name].filter(Boolean).join(' ');
  const format = saleFormatLabel(species);

  const isBulk = isBulkSpecies(species);
  const chips = speciesChips(species, animals);

  return (
    <>
      <TableRow hover sx={{ cursor: 'pointer', '& > td': { borderBottom: 'none' } }} onClick={onToggle}>
        <TableCell sx={{ pr: 0 }}>
          <IconButton size="small">
            <Iconify icon={open ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'} />
          </IconButton>
        </TableCell>

        <TableCell>
          <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
            <Avatar
              src={photo?.image || photo?.photos?.[0] || ''}
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

        <TableCell align="right">
          <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
            {canCreate && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<Iconify icon="mingcute:add-line" />}
                component={RouterLink}
                href={`${paths.dashboard.animal.new}?species_id=${species.id}`}
                state={{ from: `${pathname}${search}` }}
                onClick={(event) => event.stopPropagation()}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Nuevo ejemplar
              </Button>
            )}
            {canUpdateSpecies && (
              <Tooltip title="Editar ficha de cuidados">
                <IconButton
                  size="small"
                  component={RouterLink}
                  href={`${paths.dashboard.animal.taxonomy}?edit_species=${species.id}`}
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
        <TableCell colSpan={7} sx={{ py: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ my: 1, borderRadius: 1.5, overflow: 'hidden', bgcolor: 'background.neutral' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {canDelete && (
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
                    <TableCell>Morph</TableCell>
                    <TableCell>Sexo</TableCell>
                    <TableCell>Destino</TableCell>
                    <TableCell>Estado</TableCell>
                    {isBulk && <TableCell>Cantidad</TableCell>}
                    <TableCell>Precio</TableCell>
                    <TableCell align="right"> </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {animals.map((animal) => (
                    <CriaderoRow
                      key={animal.id}
                      animal={animal}
                      species={species}
                      showStock={isBulk}
                      canUpdate={canUpdate}
                      isSelected={selected.has(animal.id)}
                      onToggleSelect={canDelete ? onToggleSelected : undefined}
                      onMoved={onMoved}
                    />
                  ))}
                </TableBody>
              </Table>
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
function CriaderoRow({ animal, species, showStock, canUpdate, isSelected, onToggleSelect, onMoved }) {
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
            src={animal.image || animal.photos?.[0] || ''}
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
      <TableCell>{animal.morphs?.length ? animal.morphs.map((m) => m.name).join(', ') : '—'}</TableCell>
      <TableCell>{SEX_LABELS[animal.sex] ?? animal.sex}</TableCell>
      <TableCell>
        <Label variant="soft" color={PURPOSE_COLORS[purpose]}>
          {PURPOSE_LABELS[purpose]}
        </Label>
      </TableCell>
      <TableCell>
        <Label variant="soft" color={empty ? 'default' : (STATUS_COLORS[animal.status] ?? 'default')}>
          {statusLabel(animal) ?? animal.status}
        </Label>
      </TableCell>
      {showStock && <TableCell>{animal.stock ?? '—'}</TableCell>}
      <TableCell>{purpose === 'sale' ? fCurrency(animal.price) : '—'}</TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ whiteSpace: 'nowrap' }}>
          {canUpdate && <MoveAnimalMenu animal={animal} species={species} onMoved={onMoved} />}
          {canUpdate && (
            <Button size="small" component={RouterLink} href={paths.dashboard.animal.edit(animal.id)}>
              Editar
            </Button>
          )}
          <Button
            size="small"
            component={RouterLink}
            href={`${paths.dashboard.animal.log}?species=${species.id}`}
          >
            Anotar
          </Button>
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
            src={animal.image || animal.photos?.[0] || ''}
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
      <TableCell>{animal.morphs?.length ? animal.morphs.map((m) => m.name).join(', ') : '—'}</TableCell>
      <TableCell>{SEX_LABELS[animal.sex] ?? animal.sex}</TableCell>
      <TableCell>{animal.birth_date ?? '—'}</TableCell>
      <TableCell>
        <Label variant="soft" color={PURPOSE_COLORS[purpose]}>
          {PURPOSE_LABELS[purpose]}
        </Label>
      </TableCell>
      <TableCell>{purpose === 'sale' ? fCurrency(animal.price) : '—'}</TableCell>
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
