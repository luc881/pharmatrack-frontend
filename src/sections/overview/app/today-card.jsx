import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';

import { useHusbandryStatus } from 'src/actions/animal';
import { useGetDeliveries, changeDeliveryStatus } from 'src/actions/delivery';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { dueLabel, PLAN_KIND } from 'src/sections/animal/husbandry';

// ----------------------------------------------------------------------
// "Hoy": lo que hay que hacer en el día, arriba del inicio. Entregas de hoy
// (y atrasadas) con "Entregada" a un toque, y lo que toca del plan de manejo.
// Cada bloque aparece solo con su permiso (ventas / animales).
// ----------------------------------------------------------------------

const ymd = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function Deliveries({ canEdit }) {
  const today = ymd(new Date());
  // pendientes hasta hoy: las de hoy y las atrasadas
  const { deliveries, deliveriesLoading, deliveriesMutate } = useGetDeliveries({
    status: 'pending',
    dateTo: today,
    pageSize: 50,
  });

  const markDelivered = async (d) => {
    try {
      const paid =
        !d.paid &&
        Number(d.amount) > 0 &&
        window.confirm(`¿${d.buyer_name} ya te pagó ${fCurrency(d.amount)}?`);
      await changeDeliveryStatus(d, 'delivered', { paid });
      toast.success(`Entregada a ${d.buyer_name}`);
      deliveriesMutate();
    } catch (error) {
      toast.error(error?.message || 'No se pudo actualizar');
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2">Entregas</Typography>
        <Link component={RouterLink} href={paths.dashboard.delivery.root} variant="body2">
          Ver todas
        </Link>
      </Stack>
      {!deliveriesLoading && !deliveries.length && (
        <Typography variant="body2" color="text.secondary">
          No hay entregas para hoy.
        </Typography>
      )}
      <Stack divider={<Divider flexItem />} spacing={1}>
        {deliveries.map((d) => (
          <Stack key={d.id} direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {d.scheduled_time ? `${d.scheduled_time} · ` : ''}
                {d.buyer_name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {d.scheduled_date < today ? 'Atrasada · ' : ''}
                {d.place || 'Sin lugar'}
              </Typography>
            </Box>
            {canEdit && (
              <Button size="small" variant="contained" onClick={() => markDelivered(d)}>
                Entregada
              </Button>
            )}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function PlanDue() {
  const { planStatus, planStatusLoading } = useHusbandryStatus();
  const due = planStatus
    .flatMap((r) => r.plan.filter((p) => p.days_overdue >= 0).map((p) => ({ ...p, row: r })))
    .sort((a, b) => b.days_overdue - a.days_overdue);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2">Plan de manejo</Typography>
        <Link component={RouterLink} href={paths.dashboard.animal.log} variant="body2">
          Ir a la bitácora
        </Link>
      </Stack>
      {!planStatusLoading && !due.length && (
        <Typography variant="body2" color="text.secondary">
          {planStatus.length ? 'Todo al día.' : 'Ninguna especie tiene plan todavía.'}
        </Typography>
      )}
      <Stack spacing={1}>
        {due.map((p) => {
          const tag = dueLabel(p.days_overdue);
          return (
            <Stack
              key={`${p.row.species_id}-${p.kind}-${p.name}`}
              direction="row"
              spacing={1}
              alignItems="center"
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {p.name}{' '}
                  <Box component="span" sx={{ color: 'text.secondary' }}>
                    · {p.row.common_name || p.row.species_name}
                  </Box>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {PLAN_KIND[p.kind]?.label}
                </Typography>
              </Box>
              <Label color={tag.color}>{tag.label}</Label>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}

export function TodayCard({ permissions }) {
  const showDeliveries = permissions.includes('sales.read');
  const showPlan = permissions.includes('animals.read');
  if (!showDeliveries && !showPlan) return null;

  return (
    <Card>
      <CardHeader
        title="Hoy"
        avatar={<Iconify icon="solar:calendar-date-bold" sx={{ color: 'primary.main' }} />}
      />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ p: 3 }}>
        {showDeliveries && (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Deliveries canEdit={permissions.includes('sales.create')} />
          </Box>
        )}
        {showPlan && (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <PlanDue />
          </Box>
        )}
      </Stack>
    </Card>
  );
}
