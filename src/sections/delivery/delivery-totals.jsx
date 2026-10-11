import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { fCurrency } from 'src/utils/format-number';

import { useDeliverySummary } from 'src/actions/delivery';

// ----------------------------------------------------------------------
// Totales de entregas: lo cobrado en el mes (por fecha de la entrega, sin
// canceladas) y lo que falta por cobrar. Independiente de las ventas del POS:
// lo vendido por entregas no aparece en el corte de caja.
// ----------------------------------------------------------------------

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthRange = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { dateFrom: `${ym}-01`, dateTo: `${ym}-${String(last).padStart(2, '0')}` };
};

const money = (v) => fCurrency(Number(v ?? 0)) || '$0';

function Stat({ label, value, sub, color }) {
  return (
    <Box sx={{ flex: 1, minWidth: 140 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" color={color}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      )}
    </Box>
  );
}

export function DeliveryTotals() {
  const [month, setMonth] = useState(thisMonth);
  const { summary } = useDeliverySummary(monthRange(month || thisMonth()));

  return (
    <Card sx={{ p: 3, mb: 3 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2, gap: 2 }}
      >
        <Typography variant="subtitle1">Totales de entregas</Typography>
        <TextField
          size="small"
          type="month"
          label="Mes"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Stack>
      <Stack direction="row" flexWrap="wrap" gap={3}>
        <Stat
          label="Cobrado en el mes"
          value={money(summary?.collected)}
          sub={`Efectivo ${money(summary?.cash)} · Transferencia ${money(summary?.transfer)}${
            Number(summary?.other) ? ` · Otro ${money(summary?.other)}` : ''
          }`}
        />
        <Stat
          label="Por cobrar"
          value={money(summary?.to_collect)}
          sub={`${summary?.to_collect_count ?? 0} sin pagar (cualquier fecha)`}
          color={Number(summary?.to_collect) ? 'warning.main' : undefined}
        />
        <Stat label="Entregas pendientes" value={summary?.pending_count ?? 0} />
      </Stack>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 2 }}>
        Cuenta las entregas marcadas «Ya pagó» por su fecha de entrega. No incluye las ventas del
        POS.
      </Typography>
    </Card>
  );
}
