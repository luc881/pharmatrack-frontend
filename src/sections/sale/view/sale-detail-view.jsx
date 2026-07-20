import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import axiosInstance from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';
import { useGetSaleDetails, useGetSalePayments } from 'src/actions/sale';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { SalePDFDownload } from '../sale-pdf';
import { useAllProducts } from '../../product-batch/use-all-products';
import { printTicket, buildTicketText, ticketWhatsAppUrl, useTicketTemplate } from '../print-ticket';

// ----------------------------------------------------------------------

const PAYMENT_METHOD_LABELS = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

// ----------------------------------------------------------------------

export function SaleDetailView({ currentSale }) {
  const saleId = currentSale?.id;
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendEmail = async () => {
    setSending(true);
    try {
      await axiosInstance.post(`/api/v1/sales/${saleId}/email-ticket`, { email });
      toast.success(`Ticket enviado a ${email}`);
      setEmailOpen(false);
      setEmail('');
    } catch (error) {
      toast.error(error?.message || 'No se pudo enviar el correo');
    } finally {
      setSending(false);
    }
  };
  const { saleDetails, saleDetailsLoading } = useGetSaleDetails(saleId);
  const { salePayments, salePaymentsLoading } = useGetSalePayments(saleId);
  const ticketTemplate = useTicketTemplate();

  const products = useAllProducts();
  const productMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p.title])),
    [products]
  );
  const productPriceMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p.price_retail])),
    [products]
  );

  const totalItems = saleDetails.reduce((acc, d) => {
    const unitPrice = Number(d.unit_price ?? productPriceMap[d.product_id] ?? 0);
    return acc + (Number(d.quantity) || 0) * unitPrice - (Number(d.discount ?? 0));
  }, 0);

  const totalPayments = salePayments.reduce((acc, p) => acc + Number(p.amount ?? 0), 0);

  const ticketData = {
    saleId,
    date: currentSale?.created_at,
    items: saleDetails.map((d) => ({
      title: productMap[d.product_id] ?? `Producto #${d.product_id}`,
      quantity: Number(d.quantity) || 0,
      unitPrice: Number(d.unit_price ?? productPriceMap[d.product_id] ?? 0),
      discount: Number(d.discount ?? 0),
    })),
    payments: salePayments,
    business: ticketTemplate?.business_name,
    footer: ticketTemplate?.footer_message,
  };

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading={`Venta #${saleId ?? '—'}`}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Ventas', href: paths.dashboard.sale.root },
          { name: `#${saleId}` },
        ]}
        action={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<Iconify icon="solar:printer-minimalistic-bold" />}
              disabled={saleDetailsLoading || saleDetails.length === 0}
              onClick={() => printTicket(ticketData)}
            >
              Ticket
            </Button>
            <Button
              variant="outlined"
              startIcon={<Iconify icon="ic:baseline-whatsapp" />}
              disabled={saleDetailsLoading || saleDetails.length === 0}
              onClick={() => window.open(ticketWhatsAppUrl(buildTicketText(ticketData)), '_blank')}
            >
              WhatsApp
            </Button>
            <Button
              variant="outlined"
              startIcon={<Iconify icon="solar:letter-bold" />}
              disabled={saleDetailsLoading || saleDetails.length === 0}
              onClick={() => setEmailOpen(true)}
            >
              Correo
            </Button>
            <SalePDFDownload
              sale={currentSale}
              saleDetails={saleDetails}
              salePayments={salePayments}
              productMap={productMap}
            />
            <Button
              component={RouterLink}
              href={paths.dashboard.sale.edit(saleId)}
              variant="contained"
              startIcon={<Iconify icon="solar:pen-bold" />}
            >
              Editar
            </Button>
          </Stack>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Dialog open={emailOpen} onClose={() => setEmailOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Enviar ticket por correo</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            type="email"
            label="Correo del cliente"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && email.includes('@')) handleSendEmail();
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setEmailOpen(false)}>
            Cancelar
          </Button>
          <Button variant="contained" disabled={!email.includes('@') || sending} onClick={handleSendEmail}>
            {sending ? 'Enviando…' : 'Enviar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Stack spacing={3}>
        {/* Header info */}
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Información de la venta
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
              <Typography variant="body2">{currentSale?.id ?? '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Sucursal</Typography>
              <Typography variant="body2">{currentSale?.branch_id ?? '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Usuario</Typography>
              <Typography variant="body2">{currentSale?.user_id ?? '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Fecha</Typography>
              <Typography variant="body2">
                {currentSale?.created_at
                  ? new Date(currentSale.created_at).toLocaleString('es-MX')
                  : '—'}
              </Typography>
            </Box>
            {currentSale?.description && (
              <Box sx={{ gridColumn: { sm: 'span 3' } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Observaciones</Typography>
                <Typography variant="body2">{currentSale.description}</Typography>
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
                  <TableCell>Producto</TableCell>
                  <TableCell align="right">Cantidad</TableCell>
                  <TableCell align="right">Precio unit.</TableCell>
                  <TableCell align="right">Descuento</TableCell>
                  <TableCell align="right">Subtotal</TableCell>
                  <TableCell>Nota</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {saleDetailsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">Cargando...</TableCell>
                  </TableRow>
                ) : saleDetails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">Sin productos</TableCell>
                  </TableRow>
                ) : (
                  saleDetails.map((detail) => {
                    const unitPrice = Number(detail.unit_price ?? productPriceMap[detail.product_id] ?? 0);
                    const subtotal = (Number(detail.quantity) || 0) * unitPrice - (Number(detail.discount ?? 0));
                    return (
                      <TableRow key={detail.id}>
                        <TableCell>
                          {productMap[detail.product_id] ?? `Producto #${detail.product_id}`}
                        </TableCell>
                        <TableCell align="right">{detail.quantity}</TableCell>
                        <TableCell align="right">${unitPrice.toFixed(2)}</TableCell>
                        <TableCell align="right">
                          {detail.discount ? `$${Number(detail.discount).toFixed(2)}` : '$0.00'}
                        </TableCell>
                        <TableCell align="right">${subtotal.toFixed(2)}</TableCell>
                        <TableCell>{detail.description ?? '—'}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {saleDetails.length > 0 && (
            <>
              <Divider />
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Typography variant="subtitle1">
                  Total estimado: <strong>${totalItems.toFixed(2)}</strong>
                </Typography>
              </Box>
            </>
          )}
        </Card>

        {/* Payments */}
        <Card>
          <Box sx={{ p: 3, pb: 1 }}>
            <Typography variant="h6">Pagos</Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Método</TableCell>
                  <TableCell align="right">Monto</TableCell>
                  <TableCell>N° Referencia</TableCell>
                  <TableCell>Banco</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {salePaymentsLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">Cargando...</TableCell>
                  </TableRow>
                ) : salePayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">Sin pagos</TableCell>
                  </TableRow>
                ) : (
                  salePayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {PAYMENT_METHOD_LABELS[payment.method_payment] ?? payment.method_payment}
                      </TableCell>
                      <TableCell align="right">${Number(payment.amount).toFixed(2)}</TableCell>
                      <TableCell>{payment.transaction_number ?? '—'}</TableCell>
                      <TableCell>{payment.bank ?? '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {salePayments.length > 0 && (
            <>
              <Divider />
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Typography variant="subtitle1">
                  Total pagado: <strong>${totalPayments.toFixed(2)}</strong>
                </Typography>
              </Box>
            </>
          )}
        </Card>
      </Stack>
    </DashboardContent>
  );
}
