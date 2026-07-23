import { useMemo, useState } from 'react';

import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { DashboardContent } from 'src/layouts/dashboard';
import {
  useAllGenera,
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
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

import { speciesLabel, flattenGroupTree } from '../utils';

// ----------------------------------------------------------------------
// "Cultivos": tablero privado de manejo/cría por especie. Muestra unidades
// disponibles (derivadas del inventario), estado de cría y notas privadas.
// Nada de esto se expone en el sitio público.
// ----------------------------------------------------------------------

// ponytail: umbral global de bajo stock; se puede sobreescribir por especie
// (low_stock_threshold). Si un vivero necesita algo más fino, se hace por grupo.
export const DEFAULT_LOW_STOCK = 3;

export const HUSBANDRY = {
  active: { label: 'En cultivo', color: 'success' },
  paused: { label: 'Pausado', color: 'warning' },
  retired: { label: 'Retirado', color: 'default' },
};

export const STOCK = {
  ok: { label: 'OK', color: 'success' },
  low: { label: 'Bajo stock', color: 'warning' },
  out: { label: 'Agotado', color: 'error' },
};

// ponytail: unidades disponibles = suma de stock de ejemplares available
export const availableUnits = (animals) =>
  animals.reduce((sum, a) => (a.status === 'available' ? sum + (a.stock ?? 1) : sum), 0);

export const stockStateOf = (units, threshold = DEFAULT_LOW_STOCK) =>
  units === 0 ? 'out' : units <= threshold ? 'low' : 'ok';

const HUSBANDRY_OPTIONS = Object.entries(HUSBANDRY).map(([value, { label }]) => ({ value, label }));

export function CultivosView() {
  const { user } = useAuthContext();
  const canUpdate = user?.permissions?.includes('species.update');

  const { species: allSpecies, speciesLoading, speciesMutate } = useAllSpecies();
  const { genera: allGenera } = useAllGenera();
  const { groupTree } = useAnimalGroupTree();
  const groupsFlat = flattenGroupTree(groupTree);
  // Todo el inventario para derivar unidades disponibles por especie
  const { animals } = useGetAnimals({ page: 1, pageSize: 500 });

  const availableBySpecies = useMemo(() => {
    const map = {};
    animals.forEach((a) => {
      if (a.status !== 'available' || !a.species_id) return;
      map[a.species_id] = (map[a.species_id] ?? 0) + (a.stock ?? 1);
    });
    return map;
  }, [animals]);

  const [groupFilter, setGroupFilter] = useState('');
  const [genusFilter, setGenusFilter] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [editing, setEditing] = useState(null); // especie en edición o null

  // Un grupo filtra también a sus descendientes (los géneros cuelgan de cualquier nivel)
  const groupIdSet = groupFilter
    ? new Set([
        Number(groupFilter),
        ...groupsFlat.filter((g) => g.ancestors.includes(Number(groupFilter))).map((g) => g.id),
      ])
    : null;

  const speciesOptions = genusFilter
    ? allSpecies.filter((s) => s.genus?.id === Number(genusFilter))
    : allSpecies;

  // dataset chico (una fila por especie): se filtra en cada render sin memo
  const rows = allSpecies
    .map((sp) => {
      const units = availableBySpecies[sp.id] ?? 0;
      const threshold = sp.low_stock_threshold ?? DEFAULT_LOW_STOCK;
      const stockState = units === 0 ? 'out' : units <= threshold ? 'low' : 'ok';
      return { sp, units, threshold, stockState, status: sp.husbandry_status ?? 'active' };
    })
    .filter((r) => !groupIdSet || groupIdSet.has(r.sp.genus?.group?.id))
    .filter((r) => !genusFilter || r.sp.genus?.id === Number(genusFilter))
    .filter((r) => !speciesFilter || r.sp.id === Number(speciesFilter))
    .filter((r) => !statusFilter || r.status === statusFilter)
    .filter((r) => !stockFilter || r.stockState === stockFilter)
    .sort((a, b) => speciesLabel(a.sp).localeCompare(speciesLabel(b.sp)));

  const counts = useMemo(() => {
    const all = allSpecies.map((sp) => {
      const units = availableBySpecies[sp.id] ?? 0;
      const threshold = sp.low_stock_threshold ?? DEFAULT_LOW_STOCK;
      return {
        status: sp.husbandry_status ?? 'active',
        stockState: units === 0 ? 'out' : units <= threshold ? 'low' : 'ok',
      };
    });
    return {
      total: all.length,
      active: all.filter((r) => r.status === 'active').length,
      low: all.filter((r) => r.stockState === 'low').length,
      out: all.filter((r) => r.stockState === 'out').length,
    };
  }, [allSpecies, availableBySpecies]);

  const isEmpty = !speciesLoading && rows.length === 0;

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Cultivos"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Animales', href: paths.dashboard.animal.root },
          { name: 'Cultivos' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <StatCard label="Especies" value={counts.total} />
        <StatCard label="En cultivo" value={counts.active} color="success.main" />
        <StatCard label="Bajo stock" value={counts.low} color="warning.main" />
        <StatCard label="Agotadas" value={counts.out} color="error.main" />
      </Stack>

      <Card>
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
          <TextField
            select
            size="small"
            label="Estado de cría"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {HUSBANDRY_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Stock"
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="low">Bajo stock</MenuItem>
            <MenuItem value="out">Agotado</MenuItem>
            <MenuItem value="ok">Con stock</MenuItem>
          </TextField>
        </Stack>

        {isEmpty ? (
          <EmptyContent title="Sin especies" sx={{ py: 10 }} />
        ) : (
          <Scrollbar>
            <TableContainer sx={{ minWidth: 720 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Especie</TableCell>
                    <TableCell>Grupo</TableCell>
                    <TableCell align="right">Disponibles</TableCell>
                    <TableCell>Stock</TableCell>
                    <TableCell>Cría</TableCell>
                    <TableCell>Notas</TableCell>
                    <TableCell align="right"> </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map(({ sp, units, stockState, status }) => {
                    const scientific = [sp.genus?.name, sp.name].filter(Boolean).join(' ');
                    return (
                      <TableRow key={sp.id} hover>
                        <TableCell>
                          <Link
                            component={RouterLink}
                            href={paths.dashboard.animal.species(sp.id)}
                            color="inherit"
                            underline="hover"
                            sx={{ typography: 'subtitle2' }}
                          >
                            {sp.common_name ?? scientific}
                          </Link>
                          <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic', color: 'text.secondary' }}>
                            {scientific}
                          </Typography>
                        </TableCell>
                        <TableCell>{sp.genus?.group?.name ?? '—'}</TableCell>
                        <TableCell align="right">{units}</TableCell>
                        <TableCell>
                          <Label variant="soft" color={STOCK[stockState].color}>
                            {STOCK[stockState].label}
                          </Label>
                        </TableCell>
                        <TableCell>
                          <Label variant="soft" color={HUSBANDRY[status]?.color ?? 'default'}>
                            {HUSBANDRY[status]?.label ?? status}
                          </Label>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 260 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                            {sp.private_notes || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {canUpdate && (
                            <Tooltip title="Gestionar">
                              <IconButton size="small" onClick={() => setEditing(sp)}>
                                <Iconify icon="solar:pen-bold" width={18} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Scrollbar>
        )}
      </Card>

      {editing && (
        <ManageDialog
          species={editing}
          onClose={() => setEditing(null)}
          onSaved={speciesMutate}
        />
      )}
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------

export function StatCard({ label, value, color = 'text.primary' }) {
  return (
    <Card sx={{ p: 2.5, flex: 1, minWidth: 160 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ color }}>
        {value}
      </Typography>
    </Card>
  );
}

// `update`/`title` permiten reutilizar el diálogo para morphs (cría propia,
// independiente del nominal). Por defecto gestiona una especie.
export function ManageDialog({ species, onClose, onSaved, update = updateSpecies, title }) {
  const [status, setStatus] = useState(species.husbandry_status ?? 'active');
  const [threshold, setThreshold] = useState(species.low_stock_threshold ?? '');
  const [notes, setNotes] = useState(species.private_notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await update(species.id, {
        husbandry_status: status,
        low_stock_threshold: threshold === '' ? null : Number(threshold),
        private_notes: notes || null,
      });
      await onSaved();
      toast.success('Guardado');
      onClose();
    } catch (error) {
      toast.error(error?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open fullWidth maxWidth="xs" onClose={onClose}>
      <DialogTitle>{title ?? species.common_name ?? speciesLabel(species)}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
        <Autocomplete
          disableClearable
          options={HUSBANDRY_OPTIONS}
          value={HUSBANDRY_OPTIONS.find((o) => o.value === status) ?? HUSBANDRY_OPTIONS[0]}
          onChange={(_, option) => setStatus(option?.value ?? 'active')}
          getOptionLabel={(option) => option?.label ?? ''}
          isOptionEqualToValue={(option, value) => option.value === value.value}
          renderInput={(params) => <TextField {...params} label="Estado de cría" sx={{ mt: 1 }} />}
        />
        <TextField
          type="number"
          label="Umbral de bajo stock"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          helperText={`Vacío = usar el global (${DEFAULT_LOW_STOCK})`}
          slotProps={{ htmlInput: { min: 1 }, inputLabel: { shrink: true } }}
        />
        <TextField
          label="Notas privadas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          multiline
          minRows={4}
          helperText="Solo para ti — no se muestran en el sitio público"
        />
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
