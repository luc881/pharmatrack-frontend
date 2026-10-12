import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { useNavigate, useSearchParams } from 'react-router';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
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
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';

import { endpoints } from 'src/lib/axios';
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
  useAnimalCommitments,
  sendHusbandryReminder,
} from 'src/actions/animal';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { HowItWorks } from 'src/components/how-it-works';
import { EmptyContent } from 'src/components/empty-content';
import { useAsk } from 'src/components/custom-dialog/use-ask';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

import { PlanDialog } from '../husbandry-plan-card';
import { SEX_LABELS, speciesLabel, flattenGroupTree } from '../utils';
import {
  FOODS,
  fDate,
  dueLabel,
  CONDITION,
  PLAN_KIND,
  ACTIVITIES,
  planOptions,
} from '../husbandry';

// ----------------------------------------------------------------------
// Bitácora del plan de manejo. Arriba, las especies con plan (se crea o edita
// aquí o en su ficha) con lo que les toca; «Hecho» lo registra de un toque
// y tocar la especie abre el formulario. Ahí solo se pregunta «¿Comió?»; lo
// demás (cantidades, terrario, bajas, notas, fotos) queda en «Más detalles».
// Si se anotan piezas o gramos la API marca «Comió» sola (salvo «No comió»).
// En especies de venta individual se anota por ejemplar desde su renglón: el
// formulario queda fijo en ese código (no se cambia de ejemplar ahí).
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
  assisted: false,
  food_type: '',
  pieces: '',
  grams: '',
  appetite: '',
  feeding_notes: '',
  supplement: '',
  condition: '',
  condition_note: '',
  weight_g: '',
  deaths: '',
  animal_id: '',
  // si murió un ejemplar comprometido: a cuál pasa su reserva/venta/entrega
  replacement_animal_id: '',
  // la entrada es de un ejemplar (no de toda la especie); no viaja a la API
  per_animal: false,
  activities: [],
  notes: '',
  photos: [],
};

const fromLog = (log) => ({
  ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, log[k] ?? EMPTY[k]])),
  per_animal: Boolean(log.animal_id),
});

const num = (v) => (v === '' || v == null ? null : Number(v));

// Vacíos → null: la API valida tipos y no quiere cadenas vacías
const toPayload = (f) => ({
  species_id: f.species_id,
  morph_id: f.morph_id || null,
  log_date: f.log_date,
  fed: f.fed || f.assisted,
  assisted: f.assisted,
  food_type: f.food_type.trim() || null,
  pieces: num(f.pieces),
  grams: num(f.grams),
  appetite: f.appetite || null,
  feeding_notes: f.feeding_notes.trim() || null,
  supplement: f.supplement.trim() || null,
  condition: f.condition || null,
  condition_note: f.condition === 'other' ? f.condition_note.trim() || null : null,
  weight_g: num(f.weight_g),
  deaths: num(f.deaths) || null,
  // de un ejemplar, o de toda la especie con bajas descontadas de una cepa
  animal_id: f.per_animal || num(f.deaths) ? f.animal_id || null : null,
  replacement_animal_id: f.per_animal && num(f.deaths) ? f.replacement_animal_id || null : null,
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
  !p.condition &&
  p.weight_g == null &&
  !p.feeding_notes &&
  !p.deaths &&
  !p.activities.length &&
  !p.notes &&
  !p.photos.length;

// Lo que va en «Más detalles»: si la entrada ya trae algo de eso, se abre
const hasDetails = (f) =>
  Boolean(
    f.feeding_notes ||
    (!f.per_animal && f.deaths) ||
    f.activities.length ||
    f.notes ||
    f.photos.length
  );

const fold = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const scientific = (sp) => [sp.genus?.name, sp.name].filter(Boolean).join(' ');

// Ejemplares de la tabla: sin los vendidos; los que murieron van al final
// (en gris y sin «Anotar») para que su historial siga a la mano
// mismo criterio que la API: sin mayúsculas ni espacios de más
const normName = (s) => (s ?? '').toLowerCase().trim().split(/\s+/).join(' ');
const sameName = (a, b) => Boolean(a) && normName(a) === normName(b);

const specimensOf = (animals) =>
  animals
    .filter((a) => a.status !== 'sold')
    .sort(
      (a, b) =>
        (a.status === 'deceased') - (b.status === 'deceased') ||
        a.code.localeCompare(b.code, 'es', { numeric: true })
    );

const fedLabel = (log) => {
  if (log.assisted) return { label: 'Asistida', color: 'warning.main' };
  if (log.appetite === 'refused') return { label: 'Nada', color: 'error.main' };
  if (log.fed && log.appetite === 'poor') return { label: 'Poco', color: 'warning.main' };
  if (log.fed && log.appetite === 'regular') return { label: 'Regular', color: 'info.main' };
  if (log.fed) return { label: 'Todo', color: 'success.main' };
  return null;
};

const conditionText = (log) =>
  log.condition === 'other'
    ? log.condition_note || 'Otro'
    : (CONDITION[log.condition]?.label ?? '');

const grams = (v) => (v == null ? '' : `${Number(v)} g`);

const shortDate = (d) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
};

// ----------------------------------------------------------------------

// ----------------------------------------------------------------------

// Una especie: arriba solo nombre común y científico (y si algo del plan ya
// toca). Al tocarla se despliegan sus ejemplares por código, cada uno con su
// última comida y su «Anotar»; también «Toda la especie» para el terrario.
function SpeciesRow({ sp, status, canEdit, expanded, onToggle, onOpen, onPlan }) {
  const plan = status?.plan ?? (sp.husbandry_plan ?? []).map((p) => ({ ...p, days_overdue: null }));
  // lo más atrasado del plan, como aviso (sin botones)
  const worst = plan.reduce(
    (w, p) => (p.days_overdue != null && p.days_overdue > (w?.days_overdue ?? -Infinity) ? p : w),
    null
  );
  const tag = worst && worst.days_overdue >= 0 ? dueLabel(worst.days_overdue) : null;

  return (
    <Box>
      <ButtonBase
        onClick={onToggle}
        aria-expanded={expanded}
        sx={{
          width: 1,
          px: 2.5,
          py: 1.75,
          gap: 2,
          textAlign: 'left',
          justifyContent: 'flex-start',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2">{sp.common_name || scientific(sp)}</Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            {sp.common_name && <i>{scientific(sp)}</i>}
            {sp.genus?.group?.name ? `${sp.common_name ? ' · ' : ''}${sp.genus.group.name}` : ''}
          </Typography>
        </Box>
        {tag && (
          <Label color={tag.color}>
            {tag.label}
            {/* suplemento que solo les falta a algunos ejemplares */}
            {worst.pending_codes?.length > 0 && ` · ${worst.pending_codes.join(', ')}`}
          </Label>
        )}
        <Iconify
          icon={expanded ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'}
          sx={{ color: 'text.secondary', flexShrink: 0 }}
        />
      </ButtonBase>

      <Collapse in={expanded} unmountOnExit>
        <SpecimenPanel
          sp={sp}
          plan={plan}
          status={status}
          canEdit={canEdit}
          onOpen={onOpen}
          onPlan={onPlan}
        />
      </Collapse>
    </Box>
  );
}

function SpecimenPanel({ sp, plan, status, canEdit, onOpen, onPlan }) {
  const { user } = useAuthContext();
  const canCreate = user?.permissions?.includes('animals.create');
  const navigate = useNavigate();
  const { animals, animalsLoading } = useGetAnimals({ pageSize: 500, speciesId: sp.id });
  const specimens = specimensOf(animals);
  const sold = animals
    .filter((a) => a.status === 'sold')
    .sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }));
  // las entradas recientes de la especie dicen la última comida de cada ejemplar
  const { logs } = useGetHusbandryLogs({ pageSize: 500, speciesId: sp.id });
  const lastFed = {};
  const lastLog = {};
  const lastWeight = {};
  const deathLog = {};
  const lastCondition = {};
  logs.forEach((l) => {
    // vienen de la más nueva a la más vieja: la primera de cada uno es la última
    if (!l.animal_id) return;
    if (!lastLog[l.animal_id]) lastLog[l.animal_id] = l;
    if (l.fed && !lastFed[l.animal_id]) lastFed[l.animal_id] = l;
    if (l.weight_g != null && !lastWeight[l.animal_id]) lastWeight[l.animal_id] = l;
    if (l.deaths && !deathLog[l.animal_id]) deathLog[l.animal_id] = l;
    if (l.condition && !lastCondition[l.animal_id]) lastCondition[l.animal_id] = l;
  });

  // Suplementos por ejemplar: cuenta la entrada de toda la especie o la suya
  // (igual que el resumen de la API)
  const supps = plan.filter((p) => p.kind === 'supplement');
  const suppDue = (a, p) => {
    const last = logs.find(
      (l) => sameName(l.supplement, p.name) && (!l.animal_id || l.animal_id === a.id)
    );
    if (!last) return { last: null, overdue: 0 };
    const due = new Date(`${last.log_date}T12:00:00`);
    due.setDate(due.getDate() + p.every_days);
    const now = new Date(`${today()}T12:00:00`);
    return { last: last.log_date, overdue: Math.round((now - due) / 86400000) };
  };
  const cols = 7 + (supps.length ? 1 : 0) + (canEdit ? 1 : 0);

  return (
    <Box sx={{ px: 2.5, pb: 2.5, bgcolor: 'background.neutral' }}>
      <Stack
        direction="row"
        flexWrap="wrap"
        alignItems="center"
        gap={1}
        sx={{ py: 1.5, typography: 'body2', color: 'text.secondary' }}
      >
        {plan.length ? (
          <>
            Plan:{' '}
            {plan.map((p) => (
              <Label key={`${p.kind}-${p.name}`} variant="soft" color={PLAN_KIND[p.kind]?.color}>
                {p.name} · cada {p.every_days} d
              </Label>
            ))}
          </>
        ) : (
          'Sin plan'
        )}
        {status?.last_fed && <>· Última comida de la especie: {fDate(status.last_fed)}</>}
        {canEdit && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<Iconify icon={plan.length ? 'solar:pen-bold' : 'mingcute:add-line'} />}
            onClick={() => onPlan(sp)}
          >
            {plan.length ? 'Editar plan' : 'Agregar plan'}
          </Button>
        )}
      </Stack>

      <TableContainer sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
        <Table size="small" sx={GRID_SX}>
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Morph</TableCell>
              <TableCell>Sexo</TableCell>
              <TableCell>Última comida</TableCell>
              {supps.length > 0 && <TableCell>Suplemento</TableCell>}
              <TableCell>Estado</TableCell>
              <TableCell align="right">Peso</TableCell>
              <TableCell>Última entrada</TableCell>
              {canEdit && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {specimens.map((a) => {
              const fed = lastFed[a.id];
              const last = lastLog[a.id];
              const dead = a.status === 'deceased';
              return (
                <TableRow key={a.id} sx={dead ? { '& td': { color: 'text.disabled' } } : undefined}>
                  <TableCell sx={{ fontWeight: 600 }}>{a.code}</TableCell>
                  <TableCell>{a.morphs?.map((m) => m.name).join(', ')}</TableCell>
                  <TableCell>{SEX_LABELS[a.sex] ?? ''}</TableCell>
                  <TableCell>
                    {fed
                      ? `${fDate(fed.log_date)} · ${fedLabel(fed)?.label ?? ''}`
                      : 'Sin registro'}
                  </TableCell>
                  {supps.length > 0 && (
                    <TableCell>
                      {!dead &&
                        supps.map((p) => {
                          const d = suppDue(a, p);
                          const tag = dueLabel(d.overdue);
                          return (
                            <Label
                              key={p.name}
                              color={tag.color}
                              title={d.last ? `Último: ${fDate(d.last)}` : 'Sin registro'}
                              sx={{ mr: 0.5 }}
                            >
                              {supps.length > 1 && `${p.name}: `}
                              {tag.label}
                            </Label>
                          );
                        })}
                    </TableCell>
                  )}
                  <TableCell title={lastCondition[a.id] && fDate(lastCondition[a.id].log_date)}>
                    {lastCondition[a.id] ? conditionText(lastCondition[a.id]) : ''}
                  </TableCell>
                  <TableCell
                    align="right"
                    title={lastWeight[a.id] && fDate(lastWeight[a.id].log_date)}
                  >
                    {grams(lastWeight[a.id]?.weight_g)}
                  </TableCell>
                  <TableCell>{last ? fDate(last.log_date) : ''}</TableCell>
                  {canEdit && dead && (
                    <TableCell>
                      <Label color="error">
                        Murió
                        {deathLog[a.id]?.replacement_code &&
                          ` · cambiado por ${deathLog[a.id].replacement_code}`}
                      </Label>
                    </TableCell>
                  )}
                  {canEdit && !dead && (
                    <TableCell sx={{ py: '2px !important' }}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<Iconify icon="solar:pen-new-square-linear" />}
                        onClick={() => onOpen(sp, a)}
                      >
                        Anotar
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {!animalsLoading && !specimens.length && (
              <TableRow>
                <TableCell colSpan={cols} sx={{ color: 'text.secondary' }}>
                  No hay ejemplares de esta especie en inventario.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {(canEdit || canCreate) && (
        <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1.5} sx={{ mt: 1.5 }}>
          {canEdit && (
            <Button
              size="small"
              color="inherit"
              variant="outlined"
              startIcon={<Iconify icon="solar:pen-new-square-linear" />}
              onClick={() => onOpen(sp, null)}
            >
              Anotar para toda la especie
            </Button>
          )}
          {canCreate && (
            <Button
              size="small"
              color="inherit"
              variant="outlined"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() =>
                navigate(`${paths.dashboard.animal.new}?species_id=${sp.id}`, {
                  state: { from: `${paths.dashboard.animal.log}?species=${sp.id}` },
                })
              }
            >
              Nuevo ejemplar
            </Button>
          )}
          {/* los vendidos no salen en la tabla; si uno muere antes de entregarse
              se anota aquí y se puede cambiar por otro para esa venta */}
          {canEdit && sold.length > 0 && (
            <TextField
              select
              size="small"
              label="Murió uno ya vendido (sin entregar)"
              value=""
              onChange={(e) =>
                onOpen(
                  sp,
                  sold.find((a) => a.id === e.target.value),
                  { deaths: 1 }
                )
              }
              sx={{ minWidth: 280, bgcolor: 'background.paper' }}
            >
              {sold.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.code}
                  {a.morphs?.length ? ` · ${a.morphs.map((m) => m.name).join(' ')}` : ''}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>
      )}
    </Box>
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

  // Entrada de un ejemplar: fijo en ese código
  const current = form.per_animal ? animals.find((a) => a.id === form.animal_id) : null;

  // Baja de un ejemplar comprometido: ofrece cambiarlo por otro disponible
  const dying = Boolean(form.per_animal && num(form.deaths));
  const swapLocked = Boolean(editingId && form.replacement_animal_id);
  const { commitments } = useAnimalCommitments(dying && !editingId ? form.animal_id : null);
  const promised =
    commitments &&
    (commitments.status === 'reserved' || commitments.sale || commitments.deliveries.length > 0);
  const candidates = specimensOf(animals).filter(
    (a) => a.status === 'available' && a.id !== form.animal_id && (a.stock ?? 1) > 0
  );

  // Suplemento con un switch: se registra el del plan (o «Suplemento» si no hay)
  const planSupps = planOptions(species, 'supplement', []);
  const suppNames = [
    ...new Set(
      [...(planSupps.length ? planSupps : ['Suplemento']), form.supplement].filter(Boolean)
    ),
  ];

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const fedChoice = form.assisted
    ? 'assisted'
    : form.appetite === 'refused'
      ? 'none'
      : form.fed
        ? form.appetite === 'poor'
          ? 'little'
          : 'all'
        : null;
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
        {current && ` · ${current.code}`}
        <Typography variant="body2" color="text.secondary">
          {speciesLabel(species)}
          {current
            ? [current.morphs?.map((m) => m.name).join(' '), SEX_LABELS[current.sex]]
                .filter(Boolean)
                .map((x) => ` · ${x}`)
                .join('')
            : ' · Toda la especie'}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 7 }} sx={{ display: form.per_animal ? 'none' : undefined }}>
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
            <Grid size={{ xs: 12, sm: form.per_animal ? 6 : 5 }}>
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
                  fed: v === 'all' || v === 'little' || v === 'assisted',
                  assisted: v === 'assisted',
                  appetite: { all: 'good', little: 'poor', none: 'refused' }[v] ?? '',
                }))
              }
              sx={{ flexWrap: 'wrap' }}
            >
              <ToggleButton value="all">
                <Iconify icon="solar:check-circle-bold" sx={{ mr: 1 }} />
                Todo
              </ToggleButton>
              <ToggleButton value="little">
                <Iconify icon="solar:pie-chart-2-bold" sx={{ mr: 1 }} />
                Poco
              </ToggleButton>
              <ToggleButton value="none">
                <Iconify icon="solar:close-circle-bold" sx={{ mr: 1 }} />
                Nada
              </ToggleButton>
              <ToggleButton value="assisted">
                <Iconify icon="solar:hand-heart-bold" sx={{ mr: 1 }} />
                Asistida
              </ToggleButton>
            </ToggleButtonGroup>
            {form.assisted && (
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
                Alimentación asistida o forzada: no comió solo, se la diste tú. Cuenta como comida
                en el plan.
              </Typography>
            )}
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
            </Stack>
          </Collapse>

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Estado{' '}
              <Typography component="span" variant="body2" color="text.secondary">
                (opcional)
              </Typography>
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              color="primary"
              value={form.condition}
              onChange={(_, v) => setForm((f) => ({ ...f, condition: v ?? '' }))}
            >
              {Object.entries(CONDITION).map(([value, { label }]) => (
                <ToggleButton key={value} value={value}>
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Collapse in={form.condition === 'other'} unmountOnExit>
              <TextField
                fullWidth
                label="¿Qué presenta?"
                placeholder="Ej. ojo hinchado, mudando, escondido…"
                value={form.condition_note}
                onChange={set('condition_note')}
                slotProps={{ htmlInput: { maxLength: 200 } }}
                sx={{ mt: 1.5 }}
              />
            </Collapse>
          </Box>

          <TextField
            type="number"
            label="Peso (opcional)"
            value={form.weight_g}
            onChange={set('weight_g')}
            helperText={form.per_animal ? undefined : 'Mejor por ejemplar: «Anotar» en su renglón.'}
            slotProps={{
              htmlInput: { min: 0, step: 0.1, inputMode: 'decimal' },
              input: { endAdornment: <InputAdornment position="end">g</InputAdornment> },
            }}
            sx={{ maxWidth: { sm: 220 } }}
          />

          <Box>
            <Typography variant="subtitle1">Suplemento</Typography>
            {suppNames.map((name) => (
              <FormControlLabel
                key={name}
                sx={{ display: 'flex' }}
                control={
                  <Switch
                    checked={form.supplement === name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, supplement: e.target.checked ? name : '' }))
                    }
                  />
                }
                label={name === 'Suplemento' ? 'Se suplementó' : `Se suplementó con ${name}`}
              />
            ))}
            {!planSupps.length && (
              <Typography variant="caption" color="text.secondary">
                Para que registre cuál, agrégalo al plan de la especie.
              </Typography>
            )}
          </Box>

          {form.per_animal && (
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    color="error"
                    disabled={swapLocked}
                    checked={Boolean(num(form.deaths))}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        deaths: e.target.checked ? 1 : '',
                        replacement_animal_id: e.target.checked ? f.replacement_animal_id : '',
                      }))
                    }
                  />
                }
                label="Baja: murió"
              />
              {dying && !swapLocked && (
                <Typography variant="caption" color="error" component="div">
                  {current?.code ?? 'El ejemplar'} queda como «Murió» al guardar (si borras la
                  entrada, regresa como estaba).
                </Typography>
              )}
              {swapLocked && (
                <Typography variant="caption" color="text.secondary" component="div">
                  Se cambió por otro ejemplar. Para corregir la baja, borra la entrada (deshace el
                  cambio) y anótala de nuevo.
                </Typography>
              )}
            </Box>
          )}

          {dying && promised && (
            <Alert severity="warning">
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                {current?.code} ya estaba comprometido:
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5, typography: 'body2' }}>
                {commitments.status === 'reserved' && <li>Reservado para un cliente.</li>}
                {commitments.sale && (
                  <li>
                    Vendido en la venta #{commitments.sale.id} (
                    {fDate(commitments.sale.date_sale.slice(0, 10))}).
                  </li>
                )}
                {commitments.deliveries.map((d) => (
                  <li key={d.id}>
                    En la entrega pendiente de {d.buyer_name} ({fDate(d.scheduled_date)}).
                  </li>
                ))}
              </Box>
              <TextField
                select
                fullWidth
                size="small"
                label="¿Lo cambias por otro ejemplar?"
                value={form.replacement_animal_id}
                onChange={set('replacement_animal_id')}
                sx={{ mt: 1.5, bgcolor: 'background.paper' }}
                helperText={
                  form.replacement_animal_id
                    ? 'Ese ejemplar toma su lugar: la reserva, la venta (sin cambiar lo cobrado) y la entrega pasan a él.'
                    : candidates.length
                      ? 'Sin cambio, la venta o reserva queda con el que murió (para devolver o cancelar).'
                      : 'No hay otro ejemplar disponible de esta especie.'
                }
              >
                <MenuItem value="">No cambiar</MenuItem>
                {candidates.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {[a.code, a.morphs?.map((m) => m.name).join(' '), SEX_LABELS[a.sex]]
                      .filter(Boolean)
                      .join(' · ')}{' '}
                    — ${Number(a.price).toLocaleString('es-MX')}
                  </MenuItem>
                ))}
              </TextField>
            </Alert>
          )}

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
              {form.per_animal
                ? 'Notas, muda, limpieza y fotos.'
                : 'Notas, muda, limpieza, bajas y fotos.'}
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

              {!form.per_animal && (
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
              )}

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

// Historial como hoja de cálculo: un dato por celda, cuadrícula, encabezado y
// fecha fijos al desplazar. En celular se desplaza de lado igual que Excel.
const GRID_SX = {
  borderCollapse: 'separate',
  borderSpacing: 0,
  '& th, & td': {
    py: 0.75,
    px: 1.25,
    whiteSpace: 'nowrap',
    borderRight: 1,
    borderBottom: 1,
    borderColor: 'divider',
    typography: 'body2',
  },
  '& th': { bgcolor: 'background.neutral', fontWeight: 'fontWeightSemiBold' },
  '& tbody tr:nth-of-type(even) td': { bgcolor: 'action.hover' },
  '& tbody tr:hover td': { bgcolor: 'action.selected' },
  '& th:first-of-type, & td:first-of-type': {
    position: 'sticky',
    left: 0,
    zIndex: 1,
    bgcolor: 'background.paper',
  },
  '& thead th': { position: 'sticky', top: 0, zIndex: 2 },
  '& thead th:first-of-type': { zIndex: 3, bgcolor: 'background.neutral' },
};

function LogTable({ logs, canEdit, editingId, onEdit, onDelete, onPickAnimal }) {
  return (
    <TableContainer sx={{ maxHeight: 640, borderTop: 1, borderColor: 'divider' }}>
      <Table size="small" stickyHeader sx={GRID_SX}>
        <TableHead>
          <TableRow>
            <TableCell>Fecha</TableCell>
            <TableCell>Especie</TableCell>
            <TableCell>Nombre científico</TableCell>
            <TableCell>Ejemplar</TableCell>
            <TableCell>Morph</TableCell>
            <TableCell>¿Comió?</TableCell>
            <TableCell>Alimento</TableCell>
            <TableCell align="right">Piezas</TableCell>
            <TableCell align="right">Gramos</TableCell>
            <TableCell>Suplemento</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell align="right">Peso</TableCell>
            <TableCell>Terrario</TableCell>
            <TableCell align="right">Bajas</TableCell>
            <TableCell>Notas</TableCell>
            <TableCell>Fotos</TableCell>
            <TableCell>Anotó</TableCell>
            {canEdit && <TableCell />}
          </TableRow>
        </TableHead>
        <TableBody>
          {logs.map((log) => {
            const fed = fedLabel(log);
            const notes = [log.feeding_notes, log.notes].filter(Boolean).join(' · ');
            const terrarium = (log.activities ?? [])
              .filter((x) => x !== 'deaths')
              .map((x) => ACTIVITIES[x] ?? x)
              .join(', ');
            return (
              <TableRow key={log.id} selected={editingId === log.id}>
                <TableCell title={fDate(log.log_date)}>{shortDate(log.log_date)}</TableCell>
                <TableCell>{log.species_common_name || '—'}</TableCell>
                <TableCell sx={{ fontStyle: 'italic' }}>{log.species_name}</TableCell>
                <TableCell>
                  {log.animal_code ? (
                    <ButtonBase
                      onClick={() => onPickAnimal(log)}
                      title="Ver solo este ejemplar"
                      sx={{ typography: 'body2', color: 'primary.main', fontWeight: 600 }}
                    >
                      {log.animal_code}
                    </ButtonBase>
                  ) : (
                    <Box component="span" sx={{ color: 'text.disabled' }}>
                      Toda la especie
                    </Box>
                  )}
                </TableCell>
                <TableCell>{log.morph_name ?? ''}</TableCell>
                <TableCell sx={{ color: fed?.color, fontWeight: fed ? 600 : 400 }}>
                  {fed?.label ?? ''}
                </TableCell>
                <TableCell>{log.food_type ?? ''}</TableCell>
                <TableCell align="right">{log.pieces ?? ''}</TableCell>
                <TableCell align="right">{log.grams != null ? Number(log.grams) : ''}</TableCell>
                <TableCell>{log.supplement ?? ''}</TableCell>
                <TableCell
                  sx={{ color: log.condition === 'lethargic' ? 'warning.main' : undefined }}
                >
                  {conditionText(log)}
                </TableCell>
                <TableCell align="right">{grams(log.weight_g)}</TableCell>
                <TableCell>{terrarium}</TableCell>
                <TableCell align="right" sx={{ color: log.deaths ? 'error.main' : undefined }}>
                  {log.deaths || ''}
                  {log.replacement_code && ` → ${log.replacement_code}`}
                </TableCell>
                <TableCell
                  title={notes}
                  sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {notes}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    {(log.photos ?? []).map((url) => (
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
                            width: 28,
                            height: 28,
                            objectFit: 'cover',
                            borderRadius: 0.5,
                            display: 'block',
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                </TableCell>
                <TableCell>{log.user_name ?? ''}</TableCell>
                {canEdit && (
                  <TableCell sx={{ py: '0 !important' }}>
                    <IconButton size="small" aria-label="Editar" onClick={() => onEdit(log)}>
                      <Iconify icon="solar:pen-bold" width={18} />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label="Borrar"
                      color="error"
                      onClick={() => onDelete(log)}
                    >
                      <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
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
  // { id, code } al tocar un código en el historial
  const [animalFilter, setAnimalFilter] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const { mutate } = useSWRConfig();
  const refreshLogs = () =>
    mutate((key) => Array.isArray(key) && key[0] === endpoints.husbandryLog.list);

  const { logs, logsTotal, logsLoading } = useGetHusbandryLogs({
    page: page + 1,
    pageSize: rowsPerPage,
    speciesId: filterId,
    animalId: animalFilter?.id,
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
  const rows = (
    scope === 'plan'
      ? species.filter((s) => s.husbandry_plan?.length || s.id === initialSpecies)
      : species
  )
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

  // animal: ese ejemplar; null: toda la especie (no se preselecciona ejemplar)
  // preset: campos ya llenos (p. ej. la baja de uno vendido)
  const openFor = (sp, animal, preset) => {
    setEditingId(null);
    setForm({
      ...EMPTY,
      species_id: sp.id,
      log_date: today(),
      ...(animal && { animal_id: animal.id, per_animal: true }),
      ...preset,
    });
    setDialogOpen(true);
  };

  const [expandedId, setExpandedId] = useState(initialSpecies);

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
    const payload = toPayload(form);
    const problem = !form.log_date
      ? 'Pon la fecha'
      : isBlank(payload) && 'Marca si comió o anota algo en «Más detalles»';
    if (problem) {
      toast.error(problem);
      return false;
    }
    setSaving(true);
    try {
      if (editingId) await updateHusbandryLog(editingId, payload);
      else await createHusbandryLog(payload);
      toast.success(editingId ? 'Entrada actualizada' : 'Entrada guardada');
      close();
      refreshLogs();
      planStatusMutate();
      return true;
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (log) => {
    const ok = await ask({
      title: `¿Borrar la entrada del ${fDate(log.log_date)}?`,
      content: log.replacement_code
        ? `Se deshace el cambio: lo que pasó a ${log.replacement_code} (reserva, venta o entrega) regresa a ${log.animal_code}, y ${log.animal_code} vuelve a como estaba.`
        : 'Si fue una baja, el ejemplar regresa a como estaba (disponible, reservado o vendido).',
      options: [{ label: 'Borrar', value: true, color: 'error' }],
    });
    if (!ok) return;
    try {
      await deleteHusbandryLog(log.id);
      refreshLogs();
      planStatusMutate();
    } catch (error) {
      toast.error(error?.message || 'No se pudo borrar');
    }
  };

  const noPlans = !speciesLoading && !withPlan.length;

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Bitácora de manejo"
        action={
          canEdit && (
            <Button
              variant="outlined"
              startIcon={<Iconify icon="custom:send-fill" />}
              onClick={() =>
                sendHusbandryReminder()
                  .then(() => toast.success('Pendientes enviados a Telegram'))
                  .catch((e) => toast.error(e.message || 'No se pudo mandar a Telegram'))
              }
            >
              Mandar pendientes a Telegram
            </Button>
          )
        }
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
          'Esa especie aparece aquí; si algo del plan ya toca, lo dice a la derecha.',
          <>
            Toca la especie para ver sus ejemplares por código y <b>Anotar</b> en cada uno (comió,
            asistida, una muda, una baja, una foto). «Anotar para toda la especie» es para lo del
            terrario.
          </>,
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
                  expanded={expandedId === sp.id}
                  onToggle={() => setExpandedId((id) => (id === sp.id ? null : sp.id))}
                  onOpen={openFor}
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
                setAnimalFilter(null);
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

        {animalFilter && (
          <Box sx={{ px: 2.5, pb: 1.5 }}>
            <Chip
              label={`Ejemplar: ${animalFilter.code}`}
              onDelete={() => {
                setAnimalFilter(null);
                setPage(0);
              }}
            />
          </Box>
        )}

        <LogTable
          logs={logs}
          canEdit={canEdit}
          editingId={editingId}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onPickAnimal={(log) => {
            setAnimalFilter({ id: log.animal_id, code: log.animal_code });
            setPage(0);
          }}
        />

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
