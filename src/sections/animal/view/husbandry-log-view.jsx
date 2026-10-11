import { useState } from 'react';
import { useSearchParams } from 'react-router';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
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
import { RouterLink } from 'src/routes/components';

import { uploadToCloudinary } from 'src/lib/cloudinary';
import { DashboardContent } from 'src/layouts/dashboard';
import {
  useAllMorphs,
  useAllSpecies,
  useGetAnimals,
  createHusbandryLog,
  deleteHusbandryLog,
  updateHusbandryLog,
  useHusbandryStatus,
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
import {
  FOODS,
  fDate,
  APPETITE,
  dueLabel,
  PLAN_KIND,
  ACTIVITIES,
  SUPPLEMENTS,
  planOptions,
} from '../husbandry';

// ----------------------------------------------------------------------
// Bitácora del plan de manejo: qué comió cada especie (o morph), cuánto, cómo
// lo tomó, suplementos, bajas y qué más se hizo en el terrario. Todo es
// opcional salvo especie y fecha: la palomita "Comió" sola basta. Si se anotan
// piezas o gramos la API marca "Comió" sola (salvo apetito "No comió").
// Arriba, lo que toca hoy según el plan de cada especie (se edita en su ficha).
// ----------------------------------------------------------------------

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
  supplement: '',
  deaths: '',
  animal_id: '',
  activities: [],
  notes: '',
  photos: [],
};

const fromLog = (log) => Object.fromEntries(Object.keys(EMPTY).map((k) => [k, log[k] ?? EMPTY[k]]));

const num = (v) => (v === '' || v == null ? null : Number(v));

// Vacíos → null: la API valida tipos y no quiere cadenas vacías
const toPayload = (f) => ({
  species_id: f.species_id,
  morph_id: f.morph_id || null,
  log_date: f.log_date,
  fed: f.fed,
  food_type: f.food_type.trim() || null,
  pieces: num(f.pieces),
  grams: num(f.grams),
  appetite: f.appetite || null,
  feeding_notes: f.feeding_notes.trim() || null,
  supplement: f.supplement.trim() || null,
  deaths: num(f.deaths) || null,
  animal_id: num(f.deaths) ? f.animal_id || null : null,
  activities: f.activities.filter((a) => a !== 'deaths'),
  notes: f.notes.trim() || null,
  photos: f.photos,
});

const amount = (log) =>
  [log.pieces != null && `${log.pieces} pz`, log.grams != null && `${Number(log.grams)} g`]
    .filter(Boolean)
    .join(' · ');

const speciesShort = (row) => row.common_name || row.species_name;

// ----------------------------------------------------------------------

function PlanDueCard({ rows, canEdit, onRegister }) {
  const due = rows.flatMap((r) =>
    r.plan.filter((p) => p.days_overdue >= 0).map((p) => ({ ...p, row: r }))
  );
  due.sort((a, b) => b.days_overdue - a.days_overdue);

  return (
    <Card sx={{ mb: 3 }}>
      <CardHeader
        title="Toca hoy según el plan"
        subheader={
          rows.length
            ? `${rows.length} especie${rows.length === 1 ? '' : 's'} con plan. El plan se edita en la ficha de cada especie.`
            : 'Ninguna especie tiene plan todavía: agrégalo desde su ficha (Taxonomía → especie → Plan de manejo).'
        }
      />
      <Box sx={{ p: 3, pt: 2 }}>
        {rows.length > 0 && !due.length && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'success.main' }}>
            <Iconify icon="solar:check-circle-bold" />
            <Typography variant="body2">Todo al día.</Typography>
          </Stack>
        )}
        <Stack divider={<Divider flexItem />} spacing={1.25}>
          {due.map((p) => {
            const tag = dueLabel(p.days_overdue);
            return (
              <Stack
                key={`${p.row.species_id}-${p.kind}-${p.name}`}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={{ xs: 0.75, sm: 2 }}
                alignItems={{ sm: 'center' }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Link
                    component={RouterLink}
                    href={paths.dashboard.animal.species(p.row.species_id)}
                    color="inherit"
                    variant="subtitle2"
                  >
                    {speciesShort(p.row)}
                  </Link>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <Label variant="soft" color={PLAN_KIND[p.kind]?.color}>
                      {PLAN_KIND[p.kind]?.label}
                    </Label>
                    <Typography variant="body2">
                      {p.name} · cada {p.every_days} d
                    </Typography>
                  </Stack>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                  {p.last_done ? `Última: ${fDate(p.last_done)}` : 'Sin registro'}
                </Typography>
                <Label color={tag.color}>{tag.label}</Label>
                {canEdit && (
                  <Button size="small" variant="outlined" onClick={() => onRegister(p)}>
                    Registrar
                  </Button>
                )}
              </Stack>
            );
          })}
        </Stack>
      </Box>
    </Card>
  );
}

// ----------------------------------------------------------------------

export function HusbandryLogView() {
  const { user } = useAuthContext();
  const canEdit = user?.permissions?.includes('animals.update');

  const [searchParams] = useSearchParams();
  const initialSpecies = Number(searchParams.get('species')) || null;

  const { species } = useAllSpecies();

  const [form, setForm] = useState(() => ({
    ...EMPTY,
    species_id: initialSpecies,
    log_date: today(),
  }));
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [filterId, setFilterId] = useState(initialSpecies);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const { morphs } = useAllMorphs(form.species_id);
  const { animals } = useGetAnimals({ pageSize: 100, speciesId: form.species_id || undefined });
  const { planStatus, planStatusMutate } = useHusbandryStatus();
  const { logs, logsTotal, logsLoading, logsMutate } = useGetHusbandryLogs({
    page: page + 1,
    pageSize: rowsPerPage,
    speciesId: filterId,
  });

  const selectedSpecies = species.find((s) => s.id === form.species_id) ?? null;
  const filterSpecies = species.find((s) => s.id === filterId) ?? null;
  // Solo se puede descontar de ejemplares/cepas con existencia de esta especie
  const stockAnimals = form.species_id
    ? animals.filter((a) => (a.stock ?? 0) > 0 || a.id === form.animal_id)
    : [];

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
    if (uploading) return toast.error('Espera a que terminen de subir las fotos');
    setSaving(true);
    try {
      if (editingId) await updateHusbandryLog(editingId, toPayload(form));
      else await createHusbandryLog(toPayload(form));
      toast.success(editingId ? 'Entrada actualizada' : 'Entrada guardada');
      reset();
      logsMutate();
      planStatusMutate();
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
      planStatusMutate();
    } catch (error) {
      toast.error(error?.message || 'No se pudo borrar');
    }
  };

  // "Registrar" desde lo que toca: llena el formulario con la especie y el renglón
  const handleRegister = (p) => {
    setEditingId(null);
    setForm({
      ...EMPTY,
      species_id: p.row.species_id,
      log_date: today(),
      ...(p.kind === 'food' ? { fed: true, food_type: p.name } : { supplement: p.name }),
    });
    window.scrollTo({
      top: document.getElementById('log-form')?.offsetTop ?? 0,
      behavior: 'smooth',
    });
  };

  const addPhotos = async (files) => {
    setUploading(true);
    try {
      const urls = await Promise.all([...files].map((f) => uploadToCloudinary(f)));
      setForm((f) => ({ ...f, photos: [...f.photos, ...urls] }));
    } catch {
      toast.error('Error al subir las fotos');
    } finally {
      setUploading(false);
    }
  };

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

      <PlanDueCard rows={planStatus} canEdit={canEdit} onRegister={handleRegister} />

      {canEdit && (
        <Card id="log-form" sx={{ mb: 3 }}>
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
                    setForm((f) => ({
                      ...f,
                      species_id: s?.id ?? null,
                      morph_id: '',
                      animal_id: '',
                    }))
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
                  options={planOptions(selectedSpecies, 'food', FOODS)}
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

            <Autocomplete
              freeSolo
              options={planOptions(selectedSpecies, 'supplement', SUPPLEMENTS)}
              inputValue={form.supplement}
              onInputChange={(_, v) => setForm((f) => ({ ...f, supplement: v }))}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Suplemento (opcional)"
                  helperText="Ej. calcio espolvoreado en la papilla"
                />
              )}
            />

            <Divider>Terrario</Divider>

            <Stack direction="row" flexWrap="wrap" gap={1}>
              {Object.entries(ACTIVITIES)
                .filter(([value]) => value !== 'deaths')
                .map(([value, label]) => {
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

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4, md: 3 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Bajas"
                  value={form.deaths}
                  onChange={set('deaths')}
                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 8, md: 9 }}>
                <TextField
                  select
                  fullWidth
                  label="Descontar del inventario"
                  value={form.animal_id}
                  onChange={set('animal_id')}
                  disabled={!num(form.deaths)}
                  helperText={
                    editingId && form.animal_id
                      ? 'Al guardar se regresa lo descontado antes y se descuenta lo nuevo.'
                      : 'Opcional: elige el ejemplar o cepa de donde salen las bajas.'
                  }
                >
                  <MenuItem value="">No descontar</MenuItem>
                  {stockAnimals.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.code}
                      {a.morphs?.length
                        ? ` · ${a.morphs.map((m) => m.name).join(', ')}`
                        : ''} — {a.stock ?? 0} en inventario
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            <TextField
              multiline
              minRows={3}
              label="Notas"
              value={form.notes}
              onChange={set('notes')}
            />

            <Box>
              {form.photos.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                  {form.photos.map((url, i) => (
                    <Box key={url} sx={{ position: 'relative' }}>
                      <Box
                        component="img"
                        src={url}
                        alt=""
                        sx={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 1 }}
                      />
                      <IconButton
                        size="small"
                        aria-label="Quitar foto"
                        onClick={() =>
                          setForm((f) => ({ ...f, photos: f.photos.filter((_, j) => j !== i) }))
                        }
                        sx={{ position: 'absolute', top: 2, right: 2, bgcolor: 'background.paper' }}
                      >
                        <Iconify icon="mingcute:close-line" width={14} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
              <Button
                component="label"
                variant="outlined"
                loading={uploading}
                startIcon={<Iconify icon="solar:camera-add-bold" />}
              >
                Agregar fotos
                <input
                  hidden
                  multiple
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.length) addPhotos(e.target.files);
                    e.target.value = '';
                  }}
                />
              </Button>
            </Box>

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
                setFilterId(s?.id ?? null);
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
            <Table size="small" sx={{ minWidth: 960 }}>
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
                        <Typography variant="caption" component="div" color="text.secondary">
                          {amount(log)}
                        </Typography>
                      )}
                      {log.supplement && (
                        <Label variant="soft" color="secondary" sx={{ mt: 0.5 }}>
                          + {log.supplement}
                        </Label>
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
                        {(log.activities ?? []).map((a) =>
                          a === 'deaths' ? (
                            <Label key={a} variant="soft" color="error">
                              {log.deaths ?? ''} {log.deaths === 1 ? 'baja' : 'bajas'}
                              {log.stock_deducted ? ` (${log.animal_code})` : ''}
                            </Label>
                          ) : (
                            <Label key={a} variant="soft">
                              {ACTIVITIES[a] ?? a}
                            </Label>
                          )
                        )}
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
                      {log.photos?.length > 0 && (
                        <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                          {log.photos.map((url) => (
                            <Box
                              key={url}
                              component="a"
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Box
                                component="img"
                                src={url}
                                alt="Foto de la entrada"
                                sx={{
                                  width: 48,
                                  height: 48,
                                  objectFit: 'cover',
                                  borderRadius: 0.75,
                                  display: 'block',
                                }}
                              />
                            </Box>
                          ))}
                        </Stack>
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
