import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDate } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

// ----------------------------------------------------------------------

const STATUS_COLOR = { completed: 'success', cancelled: 'error', refunded: 'warning' };
const STATUS_LABEL = { completed: 'Completada', cancelled: 'Cancelada', refunded: 'Reembolsada' };

// ----------------------------------------------------------------------

export function DashboardRecentSales({ sales, loading, sx, ...other }) {
  return (
    <Card sx={sx} {...other}>
      <CardHeader title="Ventas recientes" sx={{ mb: 1 }} />

      <Scrollbar>
        <Table sx={{ minWidth: 560 }}>
          <TableHead>
            <TableRow>
              <TableCell># Venta</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Estado</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton variant="text" width="80%" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : sales.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Link
                        component={RouterLink}
                        href={paths.dashboard.sale.details(row.id)}
                        underline="hover"
                        color="inherit"
                        sx={{ typography: 'body2', fontWeight: 600 }}
                      >
                        #{row.id}
                      </Link>
                    </TableCell>

                    <TableCell sx={{ color: 'text.secondary' }}>
                      {row.date_sale ? fDate(row.date_sale) : '—'}
                    </TableCell>

                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {fCurrency(Number(row.total ?? 0))}
                    </TableCell>

                    <TableCell>
                      <Label
                        variant="soft"
                        color={STATUS_COLOR[row.status] ?? 'default'}
                      >
                        {STATUS_LABEL[row.status] ?? row.status}
                      </Label>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </Scrollbar>

      <Divider sx={{ borderStyle: 'dashed' }} />

      <Box sx={{ p: 2, textAlign: 'right' }}>
        <Button
          component={RouterLink}
          href={paths.dashboard.sale.root}
          size="small"
          color="inherit"
          endIcon={<Iconify icon="eva:arrow-ios-forward-fill" width={18} sx={{ ml: -0.5 }} />}
        >
          Ver todas
        </Button>
      </Box>
    </Card>
  );
}
