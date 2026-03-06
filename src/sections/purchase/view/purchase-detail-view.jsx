import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetPurchaseDetails } from 'src/actions/purchase';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------

export function PurchaseDetailView({ currentPurchase }) {
  const purchaseId = currentPurchase?.id;
  const { purchaseDetails, purchaseDetailsLoading } = useGetPurchaseDetails(purchaseId);

  const total = purchaseDetails.reduce(
    (acc, d) => acc + (Number(d.quantity) || 0) * (Number(d.unit_price) || 0),
    0
  );

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading={`Compra #${purchaseId ?? '—'}`}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Compras', href: paths.dashboard.purchase.root },
          { name: `#${purchaseId}` },
        ]}
        action={
          <Button
            component={RouterLink}
            href={paths.dashboard.purchase.edit(purchaseId)}
            variant="contained"
            startIcon={<Iconify icon="solar:pen-bold" />}
          >
            Editar
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Stack spacing={3}>
        {/* Header info */}
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Información de la compra
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
            }}
          >
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>ID</Typography>
              <Typography variant="body2">{currentPurchase?.id ?? '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Proveedor</Typography>
              <Typography variant="body2">{currentPurchase?.supplier_id ?? '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Usuario</Typography>
              <Typography variant="body2">{currentPurchase?.user_id ?? '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Fecha emisión</Typography>
              <Typography variant="body2">
                {currentPurchase?.date_emision
                  ? new Date(currentPurchase.date_emision).toLocaleDateString('es-MX')
                  : '—'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Total</Typography>
              <Typography variant="body2">
                {currentPurchase?.total != null ? `$${Number(currentPurchase.total).toFixed(2)}` : '—'}
              </Typography>
            </Box>
            {currentPurchase?.description && (
              <Box sx={{ gridColumn: { sm: 'span 3' } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Observaciones</Typography>
                <Typography variant="body2">{currentPurchase.description}</Typography>
              </Box>
            )}
          </Box>
        </Card>

        {/* Line items */}
        <Card>
          <Box sx={{ p: 3, pb: 1 }}>
            <Typography variant="h6">Productos</Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Producto ID</TableCell>
                  <TableCell align="right">Cantidad</TableCell>
                  <TableCell align="right">Precio unit.</TableCell>
                  <TableCell align="right">Subtotal</TableCell>
                  <TableCell>Lote</TableCell>
                  <TableCell>Vencimiento</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {purchaseDetailsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">Cargando...</TableCell>
                  </TableRow>
                ) : purchaseDetails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">Sin productos</TableCell>
                  </TableRow>
                ) : (
                  purchaseDetails.map((detail) => {
                    const subtotal = (Number(detail.quantity) || 0) * (Number(detail.unit_price) || 0);
                    return (
                      <TableRow key={detail.id}>
                        <TableCell>{detail.product_id}</TableCell>
                        <TableCell align="right">{detail.quantity}</TableCell>
                        <TableCell align="right">${Number(detail.unit_price).toFixed(2)}</TableCell>
                        <TableCell align="right">${subtotal.toFixed(2)}</TableCell>
                        <TableCell>{detail.lot_code ?? '—'}</TableCell>
                        <TableCell>
                          {detail.expiration_date
                            ? new Date(detail.expiration_date).toLocaleDateString('es-MX')
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {purchaseDetails.length > 0 && (
            <>
              <Divider />
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Typography variant="subtitle1">
                  Total: <strong>${total.toFixed(2)}</strong>
                </Typography>
              </Box>
            </>
          )}
        </Card>
      </Stack>
    </DashboardContent>
  );
}
