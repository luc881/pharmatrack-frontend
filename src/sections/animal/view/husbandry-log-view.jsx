import { useState } from 'react';
import { useSearchParams } from 'react-router';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import ToggleButton from '@mui/material/ToggleButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import useMediaQuery from '@mui/material/useMediaQuery';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';

import { uploadToCloudinary } from 'src/lib/cloudinary';
import { DashboardContent } from 'src/layouts/dashboard';
import {
  useAllMorphs,
  useAllGenera,
  useAllSpecies,
  useGetAnimals,
  createHusbandryLog,
  deleteHusbandryLog,
  updateHusbandryLog,
  useHusbandryStatus,
  useAnimalGroupTree,
  useGetHusbandryLogs,
} from 'src/actions/animal';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { HowItWorks } from 'src/components/how-it-works';
import { EmptyContent } from 'src/components/empty-content';
import { useAsk } from 'src/components/custom-dialog/use-ask';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

import { PlanDialog } from '../husbandry-plan-card';
import { speciesLabel, flattenGroupTree } from '../utils';
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
// Bitácora del plan de manejo. Arriba, las especies con plan (se crea o edita
// aquí o en su ficha) con lo que les toca; «Hecho» lo registra de un toque
// y tocar la especie abre el formulario. Ahí solo se pregunta «¿Comió?»; lo
// demás (cantidades, terrario, bajas, notas, fotos) queda en «Más detalles».
// Si se anotan piezas o gramos la API marca «Comió» sola (salvo «No comió»).
// ----------------------------------------------------------------------

const HELP_KEY = 'husbandry-log-help-hidden';

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

// Una entrada sin nada que contar no sirve en el historial
const isBlank = (p) =>
  !p.fed &&
  !p.appetite &&
  !p.food_type &&
  p.pieces == null &&
  p.grams == null &&
  !p.supplement &&
  !p.feeding_notes &&
  !p.deaths &&
  !p.activities.length &&
  !p.notes &&
  !p.photos.length;

// Lo que va en «Más detalles»: si la entrada ya trae algo de eso, se abre
const hasDetails = (f) =>
  Boolean(f.feeding_notes || f.deaths || f.activities.length || f.notes || f.photos.length);

const amount = (log) =>
  [log.pieces != null && `${log.pieces} pz`, log.grams != null && `${Number(log.grams)} g`]
    .filter(Boolean)
    .join(' · ');

const fold = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const scientific = (sp) => [sp.genus?.name, sp.name].filter(Boolean).join(' ');

// ----------------------------------------------------------------------

// ----------------------------------------------------------------------

function SpeciesRow({ sp, status, canEdit, onOpen, onQuick, onPlan }) {
  const [busy, setBusy] = useState(null);
  // Con estado del servidor (especies en cultivo) se ven fechas; si no, solo el plan
  const plan = status?.plan ?? (sp.husbandry_plan ?? []).map((p) => ({ ...p, days_overdue: null }));

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={{ xs: 1.5, md: 2 }}
      alignItems={{ md: 'center' }}
      sx={{ px: 2.5, py: 2 }}
    >
      <ButtonBase
        onClick={() => onOpen(sp)}
        disabled={!canEdit}
        aria-label={`Anotar ${speciesLabel(sp)}`}
        sx={{
          flex: '0 0 auto',
          width: { md: 280 },
          justifyContent: 'flex-start',
          textAlign: 'left',
          borderRadius: 1,
          p: 1,
          m: -1,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2">{sp.common_name || scientific(sp)}</Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            {sp.common_name && <i>{scientific(sp)}</i>}
            {sp.genus?.group?.name ? `${sp.common_name ? ' · ' : ''}${sp.genus.group.name}` : ''}
          </Typography>
          {status?.last_fed && (
            <Typography variant="caption" color="text.secondary" component="div">
              Última comida: {fDate(status.last_fed)}
            </Typography>
          )}
        </Box>
      </ButtonBase>

      <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
        {!plan.length && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Sin plan
            </Typography>
            {canEdit && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={() => onPlan(sp)}
              >
                Agregar plan
              </Button>
            )}
          </Stack>
        )}
        {plan.map((p) => {
          const tag = p.days_overdue == null ? null : dueLabel(p.days_overdue);
          const due = p.days_overdue != null && p.days_overdue >= 0;
          return (
            <Stack
              key={`${p.kind}-${p.name}`}
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
            >
              <Label variant="soft" color={PLAN_KIND[p.kind]?.color}>
                {PLAN_KIND[p.kind]?.label}
              </Label>
              <Typography variant="body2">
                {p.name} · cada {p.every_days} d
              </Typography>
              {tag && <Label color={tag.color}>{tag.label}</Label>}
              {due && canEdit && (
                <Button
                  size="small"
                  variant="contained"
                  loading={busy === p}
                  startIcon={<Iconify icon="solar:check-circle-bold" />}
                  onClick={async () => {
                    setBusy(p);
                    await onQuick(sp, p);
                    setBusy(null);
                  }}
                >
                  Hecho
                </Button>
              )}
            </Stack>
          );
        })}
      </Stack>

      {canEdit && (
        <Button
          variant="outlined"
          onClick={() => onOpen(sp)}
          startIcon={<Iconify icon="solar:pen-new-square-linear" />}
          sx={{ alignSelf: { xs: 'stretch', md: 'center' }, flexShrink: 0 }}
        >
          Anotar
        </Button>
      )}
    </Stack>
  );
}

// ----------------------------------------------------------------------

function LogDialog({ open, form, setForm, editingId, species, saving, onClose, onSave }) {
  const fullScreen = useMediaQuery((t) => t.breakpoints.down('sm'));
  const [moreOpen, setMoreOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { morphs } = useAllMorphs(form.species_id);
  const { animals } = useGetAnimals({ pageSize: 500, speciesId: form.species_id || undefined });
  // Solo se puede descontar de ejemplares/cepas con existencia de esta especie
  const stockAnimals = animals.filter((a) => (a.stock ?? 0) > 0 || a.id === form.animal_id);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const fedChoice = form.fed ? 'yes' : form.appetite === 'refused' ? 'no' : null;
  const showMore = moreOpen || hasDetails(form);

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
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
      TransitionProps={{ onExited: () => setMoreOpen(false) }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        {editingId ? 'Editar entrada' : 'Anotar en la bitácora'}
        <Typography variant="body2" color="text.secondary">
          {speciesLabel(species)}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 7 }}>
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
            <Grid size={{ xs: 12, sm: 5 }}>
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

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              ¿Comió?
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              color="primary"
              value={fedChoice}
              onChange={(_, v) =>
                setForm((f) => ({
                  ...f,
                  fed: v === 'yes',
                  appetite: v === 'no' ? 'refused' : f.appetite === 'refused' ? '' : f.appetite,
                }))
              }
            >
              <ToggleButton value="yes">
                <Iconify icon="solar:check-circle-bold" sx={{ mr: 1 }} />
                Sí comió
              </ToggleButton>
              <ToggleButton value="no">
                <Iconify icon="solar:close-circle-bold" sx={{ mr: 1 }} />
                No comió
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Collapse in={form.fed} unmountOnExit>
            <Stack spacing={2}>
              <Autocomplete
                freeSolo
                options={planOptions(species, 'food', FOODS)}
                inputValue={form.food_type}
                onInputChange={(_, v) => setForm((f) => ({ ...f, food_type: v }))}
                renderInput={(params) => <TextField {...params} label="¿Qué comió? (opcional)" />}
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  type="number"
                  label="Piezas"
                  placeholder="Ej. 6 grillos"
                  value={form.pieces}
                  onChange={set('pieces')}
                  slotProps={{ htmlInput: { min: 0, step: 1, inputMode: 'numeric' } }}
                />
                <TextField
                  fullWidth
                  type="number"
                  label="Gramos"
                  placeholder="Ej. papilla"
                  value={form.grams}
                  onChange={set('grams')}
                  slotProps={{
                    htmlInput: { min: 0, step: 0.1, inputMode: 'decimal' },
                    input: { endAdornment: <InputAdornment position="end">g</InputAdornment> },
                  }}
                />
              </Stack>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  ¿Cómo comió? (opcional)
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={form.appetite}
                  onChange={(_, v) => setForm((f) => ({ ...f, appetite: v ?? '' }))}
                  sx={{ flexWrap: 'wrap' }}
                >
                  {Object.entries(APPETITE)
                    .filter(([value]) => value !== 'refused')
                    .map(([value, { label }]) => (
                      <ToggleButton key={value} value={value}>
                        {label}
                      </ToggleButton>
                    ))}
                </ToggleButtonGroup>
              </Box>
            </Stack>
          </Collapse>

          <Autocomplete
            freeSolo
            options={planOptions(species, 'supplement', SUPPLEMENTS)}
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

          <Box>
            <Button
              color="inherit"
              onClick={() => setMoreOpen((v) => !v)}
              disabled={hasDetails(form)}
              endIcon={
                <Iconify
                  icon={showMore ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'}
                />
              }
            >
              Más detalles (opcional)
            </Button>
            <Typography variant="caption" color="text.secondary" component="div">
              Notas, muda, limpieza, bajas y fotos.
            </Typography>
          </Box>

          <Collapse in={showMore}>
            <Stack spacing={3}>
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
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Bajas"
                    value={form.deaths}
                    onChange={set('deaths')}
                    slotProps={{ htmlInput: { min: 0, step: 1, inputMode: 'numeric' } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 8 }}>
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
                          sx={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            bgcolor: 'background.paper',
                          }}
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
            </Stack>
          </Collapse>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          loading={saving}
          disabled={uploading}
          startIcon={<Iconify icon="solar:check-circle-bold" />}
          onClick={onSave}
        >
          {editingId ? 'Guardar cambios' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

function LogCard({ log, canEdit, selected, onEdit, onDelete }) {
  const food = log.food_type || (log.fed ? 'Comió' : null);
  return (
    <Card variant="outlined" sx={{ p: 2, ...(selected && { borderColor: 'primary.main' }) }}>
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            {fDate(log.log_date)}
            {log.user_name ? ` · ${log.user_name}` : ''}
          </Typography>
          <Typography variant="subtitle2" sx={{ fontStyle: 'italic' }}>
            {log.species_name}
            {log.morph_name && (
              <Box component="span" sx={{ fontStyle: 'normal', color: 'text.secondary' }}>
                {' '}
                · {log.morph_name}
              </Box>
            )}
          </Typography>
        </Box>
        {canEdit && (
          <>
            <IconButton aria-label="Editar" onClick={onEdit}>
              <Iconify icon="solar:pen-bold" />
            </IconButton>
            <IconButton aria-label="Borrar" color="error" onClick={onDelete}>
              <Iconify icon="solar:trash-bin-trash-bold" />
            </IconButton>
          </>
        )}
      </Stack>

      <Stack direction="row" flexWrap="wrap" gap={0.75} alignItems="center" sx={{ mt: 1 }}>
        {food && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            {log.fed && (
              <Iconify icon="solar:check-circle-bold" width={18} sx={{ color: 'success.main' }} />
            )}
            <Typography variant="body2">
              {food}
              {amount(log) ? ` · ${amount(log)}` : ''}
            </Typography>
          </Stack>
        )}
        {log.appetite && (
          <Label color={APPETITE[log.appetite]?.color}>{APPETITE[log.appetite]?.label}</Label>
        )}
        {log.supplement && (
          <Label variant="soft" color="secondary">
            + {log.supplement}
          </Label>
        )}
        {(log.activities ?? []).map((a) => (
          <Label key={a} variant="soft" color={a === 'deaths' ? 'error' : 'default'}>
            {a === 'deaths'
              ? `${log.deaths ?? ''} ${log.deaths === 1 ? 'baja' : 'bajas'}`
              : (ACTIVITIES[a] ?? a)}
          </Label>
        ))}
      </Stack>

      {(log.feeding_notes || log.notes) && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-line' }}>
          {[log.feeding_notes, log.notes].filter(Boolean).join('\n')}
        </Typography>
      )}

      {log.photos?.length > 0 && (
        <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
          {log.photos.map((url) => (
            <Box key={url} component="a" href={url} target="_blank" rel="noopener noreferrer">
              <Box
                component="img"
                src={url}
                alt="Foto de la entrada"
                sx={{
                  width: 56,
                  height: 56,
                  objectFit: 'cover',
                  borderRadius: 0.75,
                  display: 'block',
                }}
              />
            </Box>
          ))}
        </Stack>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------

export function HusbandryLogView() {
  const { user } = useAuthContext();
  const canEdit = user?.permissions?.includes('animals.update');
  const [ask, askDialog] = useAsk();

  const [searchParams] = useSearchParams();
  const initialSpecies = Number(searchParams.get('species')) || null;

  const { species, speciesLoading, speciesMutate } = useAllSpecies();
  const { genera } = useAllGenera();
  const { groupTree } = useAnimalGroupTree();
  const groupsFlat = flattenGroupTree(groupTree);
  const { planStatus, planStatusMutate } = useHusbandryStatus();

  const [form, setForm] = useState(EMPTY);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [planFor, setPlanFor] = useState(null);
  const [saving, setSaving] = useState(false);

  // Lista de especies: con plan por defecto; «Todas» para anotar en cualquiera
  const [scope, setScope] = useState('plan');
  const [query, setQuery] = useState('');
  const [groupId, setGroupId] = useState(null);
  const [genusId, setGenusId] = useState(null);

  const [filterId, setFilterId] = useState(initialSpecies);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const { logs, logsTotal, logsLoading, logsMutate } = useGetHusbandryLogs({
    page: page + 1,
    pageSize: rowsPerPage,
    speciesId: filterId,
  });

  const statusById = Object.fromEntries(planStatus.map((r) => [r.species_id, r]));
  const withPlan = species.filter((s) => s.husbandry_plan?.length);
  const formSpecies = species.find((s) => s.id === form.species_id) ?? null;
  const filterSpecies = species.find((s) => s.id === filterId) ?? null;

  // Un grupo filtra también a sus descendientes (igual que Cultivos)
  const groupIds = groupId
    ? new Set([
        groupId,
        ...groupsFlat.filter((g) => g.ancestors.includes(groupId)).map((g) => g.id),
      ])
    : null;
  const needle = fold(query.trim());
  const mostOverdue = (sp) =>
    Math.max(-Infinity, ...(statusById[sp.id]?.plan ?? []).map((p) => p.days_overdue));

  // dataset chico (una fila por especie): se filtra en cada render sin memo
  const rows = (scope === 'plan' ? withPlan : species)
    .filter((s) => !groupIds || groupIds.has(s.genus?.group?.id))
    .filter((s) => !genusId || s.genus?.id === genusId)
    .filter((s) => !needle || fold(speciesLabel(s)).includes(needle))
    // lo más atrasado arriba; luego con plan; luego por nombre
    .sort(
      (a, b) =>
        mostOverdue(b) - mostOverdue(a) ||
        Boolean(b.husbandry_plan?.length) - Boolean(a.husbandry_plan?.length) ||
        speciesLabel(a).localeCompare(speciesLabel(b))
    );
  const dueCount = planStatus.reduce(
    (n, r) => n + r.plan.filter((p) => p.days_overdue >= 0).length,
    0
  );

  const openFor = (sp) => {
    setEditingId(null);
    setForm({ ...EMPTY, species_id: sp.id, log_date: today() });
    setDialogOpen(true);
  };

  const handleEdit = (log) => {
    setEditingId(log.id);
    setForm(fromLog(log));
    setDialogOpen(true);
  };

  const close = () => {
    setDialogOpen(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.log_date) return toast.error('Pon la fecha');
    const payload = toPayload(form);
    if (isBlank(payload)) return toast.error('Marca si comió o anota algo en «Más detalles»');
    setSaving(true);
    try {
      if (editingId) await updateHusbandryLog(editingId, payload);
      else await createHusbandryLog(payload);
      toast.success(editingId ? 'Entrada actualizada' : 'Entrada guardada');
      close();
      logsMutate();
      planStatusMutate();
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
    return null;
  };

  const handleDelete = async (log) => {
    const ok = await ask({
      title: `¿Borrar la entrada del ${fDate(log.log_date)}?`,
      content: 'Si descontó bajas del inventario, se regresan.',
      options: [{ label: 'Borrar', value: true, color: 'error' }],
    });
    if (!ok) return;
    try {
      await deleteHusbandryLog(log.id);
      logsMutate();
      planStatusMutate();
    } catch (error) {
      toast.error(error?.message || 'No se pudo borrar');
    }
  };

  // «Hecho»: registra el renglón del plan como hecho hoy, sin formulario
  const handleQuick = async (sp, p) => {
    try {
      await createHusbandryLog(
        toPayload({
          ...EMPTY,
          species_id: sp.id,
          log_date: today(),
          ...(p.kind === 'food' ? { fed: true, food_type: p.name } : { supplement: p.name }),
        })
      );
      toast.success(`${p.name}: registrado`);
      logsMutate();
      planStatusMutate();
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar');
    }
  };

  const noPlans = !speciesLoading && !withPlan.length;

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

      <HowItWorks
        storageKey={HELP_KEY}
        question="¿Cómo funciona la bitácora?"
        summary="La bitácora es el diario de cuidados: qué comió cada especie, sus suplementos y lo que pasa en el terrario."
        steps={[
          <>
            En «Todas», toca <b>Agregar plan</b> en la especie: qué come, qué suplemento y cada
            cuántos días.
          </>,
          <>
            Esa especie aparece aquí con lo que le toca. Cuando ya lo hiciste, toca <b>Hecho</b>.
          </>,
          'Para anotar más (cuánto comió, una muda, una baja, una foto) toca la especie. Todo es opcional.',
        ]}
      />

      <Card sx={{ mb: 3 }}>
        <CardHeader
          title={scope === 'plan' ? 'Especies con plan' : 'Todas las especies'}
          subheader={
            scope === 'plan'
              ? dueCount
                ? `${dueCount} pendiente${dueCount === 1 ? '' : 's'} para hoy.`
                : withPlan.length
                  ? 'Todo al día.'
                  : null
              : 'Para anotar algo de una especie aunque no tenga plan (una muda, una baja…).'
          }
          action={
            <ToggleButtonGroup
              exclusive
              size="small"
              value={scope}
              onChange={(_, v) => v && setScope(v)}
            >
              <ToggleButton value="plan">Con plan</ToggleButton>
              <ToggleButton value="all">Todas</ToggleButton>
            </ToggleButtonGroup>
          }
          sx={{ flexWrap: 'wrap', gap: 2 }}
        />

        {scope === 'plan' && noPlans ? (
          <EmptyContent
            title="Todavía ninguna especie tiene plan de manejo"
            description="Toca «Ver especies» y, en la que quieras, «Agregar plan» (qué come y cada cuántos días). Después aparece aquí con lo que le toca."
            action={
              <Button
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={() => setScope('all')}
                sx={{ mt: 3 }}
              >
                Ver especies
              </Button>
            }
            sx={{ py: 6 }}
          />
        ) : (
          <>
            <Stack direction="row" flexWrap="wrap" gap={2} sx={{ px: 2.5, pt: 2.5, pb: 1 }}>
              <TextField
                size="small"
                placeholder="Buscar especie…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ flex: '1 1 220px' }}
              />
              <Autocomplete
                size="small"
                options={groupsFlat}
                value={groupsFlat.find((g) => g.id === groupId) ?? null}
                onChange={(_, g) => setGroupId(g?.id ?? null)}
                getOptionLabel={(g) => g?.name ?? ''}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderOption={(props, g) => (
                  <li
                    {...props}
                    key={g.id}
                    style={{ ...props.style, paddingLeft: 16 + g.depth * 16 }}
                  >
                    {g.depth > 0 && '└ '}
                    {g.name}
                  </li>
                )}
                renderInput={(params) => <TextField {...params} label="Grupo" />}
                sx={{ flex: '1 1 180px' }}
              />
              <Autocomplete
                size="small"
                options={genera}
                value={genera.find((g) => g.id === genusId) ?? null}
                onChange={(_, g) => setGenusId(g?.id ?? null)}
                getOptionLabel={(g) => g?.name ?? ''}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderInput={(params) => <TextField {...params} label="Género" />}
                sx={{ flex: '1 1 160px' }}
              />
            </Stack>

            <Stack divider={<Divider flexItem />}>
              {rows.map((sp) => (
                <SpeciesRow
                  key={sp.id}
                  sp={sp}
                  status={statusById[sp.id]}
                  canEdit={canEdit}
                  onOpen={openFor}
                  onQuick={handleQuick}
                  onPlan={setPlanFor}
                />
              ))}
            </Stack>
            {!speciesLoading && !rows.length && (
              <EmptyContent title="Ninguna especie coincide con los filtros" sx={{ py: 5 }} />
            )}
          </>
        )}
      </Card>

      <LogDialog
        open={dialogOpen}
        form={form}
        setForm={setForm}
        editingId={editingId}
        species={formSpecies}
        saving={saving}
        onClose={close}
        onSave={handleSave}
      />

      {planFor && (
        <PlanDialog
          open
          species={planFor}
          onClose={() => setPlanFor(null)}
          onSaved={() => {
            speciesMutate();
            planStatusMutate();
          }}
        />
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

        {/* Celular: tarjetas en vez de la tabla ancha */}
        <Stack spacing={1.5} sx={{ display: { md: 'none' }, p: 2 }}>
          {logs.map((log) => (
            <LogCard
              key={log.id}
              log={log}
              canEdit={canEdit}
              selected={editingId === log.id}
              onEdit={() => handleEdit(log)}
              onDelete={() => handleDelete(log)}
            />
          ))}
        </Stack>

        <TableContainer sx={{ mt: 2, display: { xs: 'none', md: 'block' } }}>
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
      {askDialog}
    </DashboardContent>
  );
}
