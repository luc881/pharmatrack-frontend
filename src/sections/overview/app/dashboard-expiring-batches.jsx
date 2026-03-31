import { useMemo } from 'react';

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

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

import { useAllProducts } from 'src/sections/product-batch/use-all-products';

// ----------------------------------------------------------------------

function expiryColor(dateStr) {
  const diffDays = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return 'error';
  if (diffDays <= 15) return 'warning';
  return 'info';
}

// ----------------------------------------------------------------------

export function DashboardExpiringBatches({ batches, loading, sx, ...other }) {
  const products = useAllProducts();

  const productMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p.title])),
    [products]
  );

  return (
    <Card sx={sx} {...other}>
      <CardHeader title="Lotes por vencer (≤30 días)" sx={{ mb: 1 }} />

      <Scrollbar>
        <Table sx={{ minWidth: 300 }}>
          <TableHead>
            <TableRow>
              <TableCell>Producto</TableCell>
              <TableCell align="right">Stock</TableCell>
              <TableCell>Vence</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 3 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton variant="text" width="80%" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : batches.length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      Sin lotes próximos a vencer
                    </TableCell>
                  </TableRow>
                )
                : batches.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ maxWidth: 160 }}>
                      <Link
                        component={RouterLink}
                        href={paths.dashboard.productBatch.edit(row.id)}
                        underline="hover"
                        color="inherit"
                        sx={{ typography: 'body2', fontWeight: 600 }}
                        noWrap
                      >
                        {productMap[row.product_id] ?? `Producto #${row.product_id}`}
                      </Link>
                    </TableCell>

                    <TableCell align="right">{row.quantity}</TableCell>

                    <TableCell>
                      <Label variant="soft" color={expiryColor(row.expiration_date)}>
                        {fDate(row.expiration_date)}
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
          href={paths.dashboard.productBatch.root}
          size="small"
          color="inherit"
          endIcon={<Iconify icon="eva:arrow-ios-forward-fill" width={18} sx={{ ml: -0.5 }} />}
        >
          Ver todos
        </Button>
      </Box>
    </Card>
  );
}
