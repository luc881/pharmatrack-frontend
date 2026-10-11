import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';
import Autocomplete from '@mui/material/Autocomplete';
import ToggleButton from '@mui/material/ToggleButton';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';
import {
  useAllMorphs,
  useAllSpecies,
  createHusbandryLog,
  deleteHusbandryLog,
  updateHusbandryLog,
  useGetHusbandryLogs,
} from 'src/actions/animal';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

import { speciesLabel } from '../utils';

// ----------------------------------------------------------------------
// Bitácora del plan de manejo: qué comió cada especie (o morph), cuánto, cómo
// lo tomó y qué más se hizo en el terrario. Todo es opcional salvo especie y
// fecha: la palomita "Comió" sola basta para el registro rápido. Si se anotan
// piezas o gramos la API marca "Comió" sola (salvo apetito "No comió").
// ----------------------------------------------------------------------

export const APPETITE = {
  good: { label: 'Bien', color: 'success' },
  regular: { label: 'Regular', color: 'info' },
  poor: { label: 'Poco', color: 'warning' },
  refused: { label: 'No comió', color: 'error' },
};

export const ACTIVITIES = {
  misted: 'Rociado',
  cleaned: 'Limpieza',
  substrate: 'Cambio de sustrato',
  molt: 'Muda',
  eggs: 'Puesta / ootecas',
  births: 'Nacimientos',
  deaths: 'Bajas',
};

// Sugerencias; se puede escribir cualquier otro alimento
const FOODS = [
  'Grillos',
  'Cucarachas dubia',
  'Tenebrios',
  'Gusano de seda',
  'Papilla',
  'Fruta',
  'Verdura',
  'Hojas',
  'Hojarasca',
  'Croqueta',
];

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const EMPTY = {
  species_id: null,
  morph_id: '',
  log_date: '',
  fed: false,
  food_type: '',
  pieces: '',
  grams: '',
  appetite: '',
  feeding_notes: '',
  activities: [],
  notes: '',
};

const fromLog = (log) => ({
  ...EMPTY,
  ...Object.fromEntries(Object.entries(log).map(([k, v]) => [k, v ?? EMPTY[k] ?? ''])),
  species_id: log.species_id,
});

// Vacíos → null: la API valida tipos y no quiere cadenas vacías
const toPayload = (f) => ({
  species_id: f.species_id,
  morph_id: f.morph_id || null,
  log_date: f.log_date,
  fed: f.fed,
  food_type: f.food_type.trim() || null,
  pieces: f.pieces === '' ? null : Number(f.pieces),
  grams: f.grams === '' ? null : Number(f.grams),
  appetite: f.appetite || null,
  feeding_notes: f.feeding_notes.trim() || null,
  activities: f.activities,
  notes: f.notes.trim() || null,
});

const amount = (log) =>
  [log.pieces != null && `${log.pieces} pz`, log.grams != null && `${Number(log.grams)} g`]
    .filter(Boolean)
    .join(' · ');

const fDate = (d) =>
  new Date(`${d}T12:00:00`).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

// ----------------------------------------------------------------------

export function HusbandryLogView() {
  const { user } = useAuthContext();
  const canEdit = user?.permissions?.includes('animals.update');

  const { species } = useAllSpecies();

  const [form, setForm] = useState(() => ({ ...EMPTY, log_date: today() }));
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [filterSpecies, setFilterSpecies] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const { morphs } = useAllMorphs(form.species_id);
  const { logs, logsTotal, logsLoading, logsMutate } = useGetHusbandryLogs({
    page: page + 1,
    pageSize: rowsPerPage,
    speciesId: filterSpecies?.id,
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const reset = () => {
    // Conserva especie y fecha: lo normal es registrar varias seguidas
    setForm((f) => ({
      ...EMPTY,
      species_id: f.species_id,
      morph_id: f.morph_id,
      log_date: f.log_date,
    }));
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.species_id) return toast.error('Elige la especie');
    if (!form.log_date) return toast.error('Pon la fecha');
    setSaving(true);
    try {
      if (editingId) await updateHusbandryLog(editingId, toPayload(form));
      else await createHusbandryLog(toPayload(form));
      toast.success(editingId ? 'Entrada actualizada' : 'Entrada guardada');
      reset();
      logsMutate();
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
    return null;
  };

  const handleEdit = (log) => {
    setForm(fromLog(log));
    setEditingId(log.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (log) => {
    // ponytail: confirm nativo; ConfirmDialog si se vuelve molesto

    if (!window.confirm(`¿Borrar la entrada del ${fDate(log.log_date)}?`)) return;
    try {
      await deleteHusbandryLog(log.id);
      if (editingId === log.id) reset();
      logsMutate();
    } catch (error) {
      toast.error(error?.message || 'No se pudo borrar');
    }
  };

  const selectedSpecies = species.find((s) => s.id === form.species_id) ?? null;

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Bitácora de manejo"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Animales', href: paths.dashboard.animal.root },
          { name: 'Bitácora de manejo' },
        ]}
        sx={{ mb: 3 }}
      />

      {canEdit && (
        <Card sx={{ mb: 3 }}>
          <CardHeader
            title={editingId ? 'Editar entrada' : 'Nueva entrada'}
            subheader="Basta con la palomita «Comió»; lo demás es opcional."
          />
          <Stack spacing={3} sx={{ p: 3 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 5 }}>
                <Autocomplete
                  options={species}
                  value={selectedSpecies}
                  onChange={(_, s) =>
                    setForm((f) => ({ ...f, species_id: s?.id ?? null, morph_id: '' }))
                  }
                  getOptionLabel={speciesLabel}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params) => <TextField {...params} label="Especie" required />}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <TextField
                  select
                  fullWidth
                  label="Morph (opcional)"
                  value={form.morph_id}
                  onChange={set('morph_id')}
                  disabled={!morphs.length}
                >
                  <MenuItem value="">Toda la especie</MenuItem>
                  {morphs.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  fullWidth
                  type="date"
                  label="Fecha"
                  value={form.log_date}
                  onChange={set('log_date')}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
            </Grid>

            <Divider>Alimentación</Divider>

            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.fed}
                      onChange={(e) => setForm((f) => ({ ...f, fed: e.target.checked }))}
                    />
                  }
                  label="Comió"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Autocomplete
                  freeSolo
                  options={FOODS}
                  inputValue={form.food_type}
                  onInputChange={(_, v) => setForm((f) => ({ ...f, food_type: v }))}
                  renderInput={(params) => <TextField {...params} label="Tipo de alimento" />}
                />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Piezas"
                  value={form.pieces}
                  onChange={set('pieces')}
                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
                />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Gramos"
                  value={form.grams}
                  onChange={set('grams')}
                  slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
                />
              </Grid>
            </Grid>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                ¿Cómo comieron?
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={form.appetite}
                onChange={(_, v) => setForm((f) => ({ ...f, appetite: v ?? '' }))}
                sx={{ flexWrap: 'wrap' }}
              >
                {Object.entries(APPETITE).map(([value, { label }]) => (
                  <ToggleButton key={value} value={value}>
                    {label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            <TextField
              multiline
              minRows={2}
              label="Notas de alimentación"
              placeholder="¿Comen bien? ¿Algún problema? Ej. sobró papilla, no tocaron los grillos…"
              value={form.feeding_notes}
              onChange={set('feeding_notes')}
            />

            <Divider>Terrario</Divider>

            <Stack direction="row" flexWrap="wrap" gap={1}>
              {Object.entries(ACTIVITIES).map(([value, label]) => {
                const on = form.activities.includes(value);
                return (
                  <Chip
                    key={value}
                    label={label}
                    color={on ? 'primary' : 'default'}
                    variant={on ? 'filled' : 'outlined'}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        activities: on
                          ? f.activities.filter((a) => a !== value)
                          : [...f.activities, value],
                      }))
                    }
                  />
                );
              })}
            </Stack>

            <TextField
              multiline
              minRows={3}
              label="Notas"
              value={form.notes}
              onChange={set('notes')}
            />

            <Stack direction="row" spacing={1.5} justifyContent="flex-end">
              {editingId && (
                <Button variant="outlined" color="inherit" onClick={reset}>
                  Cancelar
                </Button>
              )}
              <Button
                variant="contained"
                loading={saving}
                startIcon={<Iconify icon="solar:check-circle-bold" />}
                onClick={handleSave}
              >
                {editingId ? 'Guardar cambios' : 'Guardar entrada'}
              </Button>
            </Stack>
          </Stack>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Historial"
          action={
            <Autocomplete
              size="small"
              options={species}
              value={filterSpecies}
              onChange={(_, s) => {
                setFilterSpecies(s);
                setPage(0);
              }}
              getOptionLabel={speciesLabel}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => <TextField {...params} label="Filtrar especie" />}
              sx={{ width: { xs: 200, sm: 300 } }}
            />
          }
          sx={{ flexWrap: 'wrap', gap: 2 }}
        />

        <TableContainer sx={{ mt: 2 }}>
          <Scrollbar>
            <Table size="small" sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Especie</TableCell>
                  <TableCell>Alimento</TableCell>
                  <TableCell>Apetito</TableCell>
                  <TableCell>Terrario</TableCell>
                  <TableCell>Notas</TableCell>
                  {canEdit && <TableCell />}
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    hover
                    selected={editingId === log.id}
                    sx={{ verticalAlign: 'top' }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {fDate(log.log_date)}
                      {log.user_name && (
                        <Typography variant="caption" component="div" color="text.secondary">
                          {log.user_name}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box component="span" sx={{ fontStyle: 'italic' }}>
                        {log.species_name}
                      </Box>
                      {log.morph_name && (
                        <Typography variant="caption" component="div" color="text.secondary">
                          {log.morph_name}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        {log.fed && (
                          <Iconify
                            icon="solar:check-circle-bold"
                            width={18}
                            sx={{ color: 'success.main' }}
                          />
                        )}
                        <span>{log.food_type || (log.fed ? 'Comió' : '—')}</span>
                      </Stack>
                      {amount(log) && (
                        <Typography variant="caption" color="text.secondary">
                          {amount(log)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.appetite && (
                        <Label color={APPETITE[log.appetite]?.color}>
                          {APPETITE[log.appetite]?.label}
                        </Label>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" flexWrap="wrap" gap={0.5}>
                        {(log.activities ?? []).map((a) => (
                          <Label key={a} variant="soft">
                            {ACTIVITIES[a] ?? a}
                          </Label>
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 320, whiteSpace: 'pre-line' }}>
                      {log.feeding_notes && <div>{log.feeding_notes}</div>}
                      {log.notes && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: log.feeding_notes ? 0.5 : 0 }}
                        >
                          {log.notes}
                        </Typography>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <IconButton aria-label="Editar" onClick={() => handleEdit(log)}>
                          <Iconify icon="solar:pen-bold" />
                        </IconButton>
                        <IconButton
                          aria-label="Borrar"
                          color="error"
                          onClick={() => handleDelete(log)}
                        >
                          <Iconify icon="solar:trash-bin-trash-bold" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>

        {!logsLoading && !logs.length && (
          <EmptyContent title="Sin entradas todavía" sx={{ py: 6 }} />
        )}

        <TablePagination
          component="div"
          count={logsTotal}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[25, 50, 100]}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setPage(0);
          }}
          labelRowsPerPage="Por página"
        />
      </Card>
    </DashboardContent>
  );
}
