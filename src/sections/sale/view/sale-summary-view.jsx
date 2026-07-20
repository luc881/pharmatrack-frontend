import useSWR from 'swr';
import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { fCurrency } from 'src/utils/format-number';

import { fetcher } from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------
// Corte de caja: totales de ventas completadas en un rango (default: hoy),
// top de productos y desglose por método de pago. Imprimible.
// ----------------------------------------------------------------------

const today = () => new Date().toISOString().slice(0, 10);

const PAYMENT_LABELS = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
};

function StatCard({ label, value, color = 'text.primary' }) {
  return (
    <Card sx={{ p: 3, flex: 1, minWidth: 180 }}>
      <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ color }}>
        {value}
      </Typography>
    </Card>
  );
}

export function SaleSummaryView() {
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());

  const url = `/api/v1/sales/summary?date_from=${dateFrom}T00:00:00&date_to=${dateTo}T23:59:59`;
  const { data, isLoading } = useSWR(url, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Corte de caja"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Ventas', href: paths.dashboard.sale.root },
          { name: 'Corte' },
        ]}
        action={
          <Button
            variant="outlined"
            startIcon={<Iconify icon="solar:printer-minimalistic-bold" />}
            onClick={() => window.print()}
          >
            Imprimir
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <TextField
          size="small"
          type="date"
          label="Desde"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          size="small"
          type="date"
          label="Hasta"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button
          size="small"
          color="inherit"
          onClick={() => {
            setDateFrom(today());
            setDateTo(today());
          }}
        >
          Hoy
        </Button>
      </Stack>

      {isLoading || !data ? (
        <EmptyContent title="Calculando…" sx={{ py: 10 }} />
      ) : (
        <Stack spacing={3}>
          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
            <StatCard label="Ventas completadas" value={data.count} />
            <StatCard label="Total cobrado" value={fCurrency(data.total)} color="success.main" />
            <StatCard label="Descuentos aplicados" value={fCurrency(data.discounts)} color="warning.main" />
            <StatCard label="Impuestos" value={fCurrency(data.tax)} />
          </Stack>

          <Box sx={{ gap: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' } }}>
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Lo más vendido
              </Typography>
              {data.top_products.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                  Sin ventas en el rango
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell align="right">Cant.</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.top_products.map((row) => (
                      <TableRow key={row.title}>
                        <TableCell>{row.title}</TableCell>
                        <TableCell align="right">{row.quantity}</TableCell>
                        <TableCell align="right">{fCurrency(row.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>

            <Card sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Por método de pago
              </Typography>
              {data.payments.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                  Sin pagos registrados
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {data.payments.map((row) => (
                    <Box key={row.method} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {PAYMENT_LABELS[row.method] ?? row.method}
                      </Typography>
                      <Typography variant="subtitle2">{fCurrency(row.amount)}</Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Card>
          </Box>
        </Stack>
      )}
    </DashboardContent>
  );
}
