import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { updateSpecies, useHusbandryStatus } from 'src/actions/animal';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { FOODS, fDate, dueLabel, PLAN_KIND, SUPPLEMENTS } from './husbandry';

// ----------------------------------------------------------------------
// Plan de manejo de una especie (privado): qué se le da y cada cuántos días,
// cuándo toca lo siguiente y lo que pasó este mes según la bitácora.
// ----------------------------------------------------------------------

const MONTH = [
  ['feedings', 'Comidas'],
  ['molt', 'Mudas'],
  ['eggs', 'Puestas'],
  ['births', 'Nacimientos'],
  ['deaths', 'Bajas'],
];

function PlanDialog({ species, open, onClose, onSaved }) {
  const [rows, setRows] = useState(() =>
    (species.husbandry_plan ?? []).map((p) => ({ ...p, every_days: String(p.every_days) }))
  );
  const [saving, setSaving] = useState(false);

  const setRow = (i, patch) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const handleSave = async () => {
    const plan = rows
      .filter((r) => r.name.trim())
      .map((r) => ({ kind: r.kind, name: r.name.trim(), every_days: Number(r.every_days) }));
    if (
      plan.some((p) => !Number.isInteger(p.every_days) || p.every_days < 1 || p.every_days > 365)
    ) {
      return toast.error('"Cada" debe ser de 1 a 365 días');
    }
    setSaving(true);
    try {
      await updateSpecies(species.id, { husbandry_plan: plan });
      toast.success('Plan guardado');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
    return null;
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Plan de manejo</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Qué se le da y cada cuántos días. La bitácora cuenta como hecho un renglón cuando anotas
          ese alimento (o solo la palomita «Comió») o ese suplemento.
        </Typography>
        <Stack spacing={2}>
          {rows.map((r, i) => (
            <Stack
              key={i}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ sm: 'center' }}
            >
              <TextField
                select
                size="small"
                label="Tipo"
                value={r.kind}
                onChange={(e) => setRow(i, { kind: e.target.value })}
                sx={{ minWidth: 140 }}
              >
                {Object.entries(PLAN_KIND).map(([value, { label }]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
              <Autocomplete
                freeSolo
                size="small"
                options={r.kind === 'food' ? FOODS : SUPPLEMENTS}
                inputValue={r.name}
                onInputChange={(_, v) => setRow(i, { name: v })}
                renderInput={(params) => <TextField {...params} label="Qué" />}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                type="number"
                label="Cada (días)"
                value={r.every_days}
                onChange={(e) => setRow(i, { every_days: e.target.value })}
                slotProps={{ htmlInput: { min: 1, max: 365 } }}
                sx={{ width: { sm: 120 } }}
              />
              <IconButton
                aria-label="Quitar renglón"
                color="error"
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
              >
                <Iconify icon="solar:trash-bin-trash-bold" />
              </IconButton>
            </Stack>
          ))}
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => setRows((rs) => [...rs, { kind: 'food', name: '', every_days: '3' }])}
            >
              Comida
            </Button>
            <Button
              size="small"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() =>
                setRows((rs) => [...rs, { kind: 'supplement', name: '', every_days: '7' }])
              }
            >
              Suplemento
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="contained" loading={saving} onClick={handleSave}>
          Guardar plan
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function HusbandryPlanCard({ species, canEdit, onSaved }) {
  const [open, setOpen] = useState(false);
  const { planStatus, planStatusMutate } = useHusbandryStatus(species.id);
  const status = planStatus[0];

  return (
    <Card sx={{ p: 3, border: (t) => `dashed 1px ${t.vars.palette.divider}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Iconify icon="solar:lock-keyhole-bold" width={16} sx={{ color: 'text.disabled' }} />
        <Typography variant="subtitle2">Plan de manejo (privado)</Typography>
      </Box>

      {!status?.plan.length && (
        <Typography variant="body2" color="text.secondary">
          Sin plan. Agrega qué comen y qué suplementos llevan, y cada cuántos días.
        </Typography>
      )}

      <Stack spacing={1.25}>
        {status?.plan.map((p) => {
          const tag = dueLabel(p.days_overdue);
          return (
            <Box key={`${p.kind}-${p.name}`}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {p.name}
                </Typography>
                <Label color={tag.color}>{tag.label}</Label>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {PLAN_KIND[p.kind]?.label} · cada {p.every_days} d ·{' '}
                {p.last_done ? `última ${fDate(p.last_done)}` : 'sin registro'}
              </Typography>
            </Box>
          );
        })}
      </Stack>

      {status && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Última comida
            </Typography>
            <Typography variant="body2">
              {status.last_fed ? fDate(status.last_fed) : '—'}
            </Typography>
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            component="div"
            sx={{ mt: 1, mb: 0.5 }}
          >
            Este mes
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 0.5 }}>
            {MONTH.map(([key, label]) => (
              <Box key={key} sx={{ textAlign: 'center' }}>
                <Typography
                  variant="subtitle1"
                  color={key === 'deaths' && status.month[key] ? 'error.main' : undefined}
                >
                  {status.month[key] ?? 0}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
        {canEdit && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<Iconify icon="solar:pen-bold" width={16} />}
            onClick={() => setOpen(true)}
          >
            Editar plan
          </Button>
        )}
        <Button
          size="small"
          component={RouterLink}
          href={`${paths.dashboard.animal.log}?species=${species.id}`}
          startIcon={<Iconify icon="solar:list-bold" width={16} />}
        >
          Ver bitácora
        </Button>
      </Stack>

      {open && (
        <PlanDialog
          species={species}
          open={open}
          onClose={() => setOpen(false)}
          onSaved={() => {
            planStatusMutate();
            onSaved?.();
          }}
        />
      )}
    </Card>
  );
}
