import { useSearchParams } from 'react-router';
import { useBoolean } from 'minimal-shared/hooks';
import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
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
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

import { QrLabelsDialog } from '../qr-labels-dialog';
import {
  SEX_LABELS,
  speciesLabel,
  STATUS_COLORS,
  STATUS_LABELS,
  saleFormatLabel,
  flattenGroupTree,
} from '../utils';

// ----------------------------------------------------------------------

// La lista agrupa por especie (como producto → lotes): la fila muestra la
// cantidad por estado y al expandir salen los ejemplares con su folio.
export function AnimalListView() {
  const confirmDialog = useBoolean();

  const { user } = useAuthContext();
  const canCreate = user?.permissions?.includes('animals.create');
  const canUpdate = user?.permissions?.includes('animals.update');
  const canDelete = user?.permissions?.includes('animals.delete');

  // El breadcrumb del detalle enlaza aquí con ?genus_id= / ?species_id=
  const [searchParams] = useSearchParams();

  const [groupFilter, setGroupFilter] = useState('');
  const [genusFilter, setGenusFilter] = useState(() => Number(searchParams.get('genus_id')) || '');
  const [speciesFilter, setSpeciesFilter] = useState(() => Number(searchParams.get('species_id')) || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [rowToDelete, setRowToDelete] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
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
  const { animals, animalsLoading, animalsError, animalsMutate } = useGetAnimals({
    page: 1,
    pageSize: 500,
    groupId: groupFilter || undefined,
    genusId: genusFilter || undefined,
    speciesId: speciesFilter || undefined,
    status: statusFilter || undefined,
  });

  const grouped = useMemo(() => {
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
    return [...map.values()].sort((a, b) =>
      speciesLabel(a.species).localeCompare(speciesLabel(b.species))
    );
  }, [animals]);

  const toggleExpanded = (speciesId) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(speciesId)) next.delete(speciesId);
      else next.add(speciesId);
      return next;
    });

  const handleFilter = useCallback((setter) => (event) => setter(event.target.value), []);

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

  const renderFilters = () => (
    <Stack direction="row" spacing={2} sx={{ p: 2.5, flexWrap: 'wrap', gap: 2 }}>
      <TextField select size="small" label="Grupo" value={groupFilter} onChange={handleFilter(setGroupFilter)} sx={{ minWidth: 180 }}>
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
      <TextField select size="small" label="Especie" value={speciesFilter} onChange={handleFilter(setSpeciesFilter)} sx={{ minWidth: 220 }}>
        <MenuItem value="">Todas</MenuItem>
        {speciesOptions.map((s) => (
          <MenuItem key={s.id} value={s.id}>
            {speciesLabel(s)}
          </MenuItem>
        ))}
      </TextField>
      <TextField select size="small" label="Estado" value={statusFilter} onChange={handleFilter(setStatusFilter)} sx={{ minWidth: 160 }}>
        <MenuItem value="">Todos</MenuItem>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <MenuItem key={value} value={value}>
            {label}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );

  const isEmpty = !animalsLoading && !grouped.length;

  return (
    <>
      <DashboardContent>
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

        <Card>
          {renderFilters()}

          {isEmpty ? (
            animalsError ? (
              <EmptyContent
                title="No se pudieron cargar los animales"
                description={animalsError.message}
                sx={{ py: 10 }}
              />
            ) : (
              <EmptyContent sx={{ py: 10 }} />
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
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                        onDelete={handleDeleteRow}
                        onPrintLabels={() => setLabelsFor(entry)}
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

// ----------------------------------------------------------------------

function SpeciesRows({ entry, open, onToggle, canUpdate, canDelete, onDelete, onPrintLabels }) {
  const { species, animals } = entry;

  const photo = animals.find((a) => a.image || a.photos?.[0]);
  const prices = animals.map((a) => a.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const scientific = [species.genus?.name, species.name].filter(Boolean).join(' ');
  const format = saleFormatLabel(species);

  // Cepas/paquetes: un registro puede valer N unidades — la cantidad real es el stock
  const isBulk = species.sale_format && species.sale_format !== 'individual';
  const totalUnits = animals.reduce((sum, a) => sum + (a.stock ?? 1), 0);

  const statusCounts = animals.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

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
              <Typography variant="subtitle2">{species.common_name ?? scientific}</Typography>
              <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                {scientific}
              </Typography>
            </Box>
          </Box>
        </TableCell>

        <TableCell>{species.genus?.group?.name ?? '—'}</TableCell>

        <TableCell>
          <Stack direction="row" spacing={0.5}>
            {isBulk && (
              <Label variant="soft" color="info">
                {totalUnits} unidad{totalUnits === 1 ? '' : 'es'}
              </Label>
            )}
            {Object.entries(STATUS_LABELS).map(([status, label]) =>
              statusCounts[status] ? (
                <Label key={status} variant="soft" color={STATUS_COLORS[status]}>
                  {statusCounts[status]} {label.toLowerCase()}
                  {statusCounts[status] > 1 ? 's' : ''}
                </Label>
              ) : null
            )}
          </Stack>
        </TableCell>

        <TableCell>
          {minPrice === maxPrice
            ? fCurrency(minPrice)
            : `${fCurrency(minPrice)} – ${fCurrency(maxPrice)}`}
        </TableCell>

        <TableCell>{format ?? '—'}</TableCell>

        <TableCell align="right">
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
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={7} sx={{ py: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ my: 1, borderRadius: 1.5, overflow: 'hidden', bgcolor: 'background.neutral' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Código</TableCell>
                    <TableCell>Morphs</TableCell>
                    <TableCell>Sexo</TableCell>
                    <TableCell>Nacimiento</TableCell>
                    <TableCell>Precio</TableCell>
                    <TableCell>Estado</TableCell>
                    {isBulk && <TableCell>Stock</TableCell>}
                    <TableCell>Doc. legal</TableCell>
                    <TableCell align="right"> </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {animals.map((animal) => (
                    <AnimalRow
                      key={animal.id}
                      animal={animal}
                      showStock={isBulk}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                      onDelete={onDelete}
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

function AnimalRow({ animal, showStock = false, canUpdate, canDelete, onDelete }) {
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
    <TableRow hover>
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
      <TableCell>{fCurrency(animal.price)}</TableCell>
      <TableCell>
        <Label variant="soft" color={STATUS_COLORS[animal.status] ?? 'default'}>
          {STATUS_LABELS[animal.status] ?? animal.status}
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
        {canDelete && animal.status !== 'sold' && (
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
