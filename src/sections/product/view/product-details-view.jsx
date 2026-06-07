import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Avatar from '@mui/material/Avatar';
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

import { fDate } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetBatchesByProduct } from 'src/actions/product-batch';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------

function expiryStatus(dateStr) {
  if (!dateStr) return { label: '—', color: 'default' };
  const today = new Date();
  const expiry = new Date(dateStr);
  const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: 'Vencido', color: 'error' };
  if (diffDays <= 30) return { label: `Vence en ${diffDays}d`, color: 'warning' };
  if (diffDays <= 90) return { label: fDate(dateStr), color: 'info' };
  return { label: fDate(dateStr), color: 'success' };
}

export function ProductDetailsView({ product, error, loading }) {
  const { batches, batchesLoading } = useGetBatchesByProduct(product?.id);

  const tracksBatches = product?.tracks_batches !== false;
  const totalStock = batches.reduce((s, b) => s + Number(b.quantity), 0);

  if (loading) {
    return (
      <DashboardContent sx={{ pt: 5 }}>
        <Typography>Cargando…</Typography>
      </DashboardContent>
    );
  }

  if (error || !product) {
    return (
      <DashboardContent sx={{ pt: 5 }}>
        <EmptyContent
          filled
          title="Producto no encontrado"
          action={
            <Button
              component={RouterLink}
              href={paths.dashboard.product.root}
              startIcon={<Iconify width={16} icon="eva:arrow-ios-back-fill" />}
              sx={{ mt: 3 }}
            >
              Volver al listado
            </Button>
          }
          sx={{ py: 10, height: 'auto', flexGrow: 'unset' }}
        />
      </DashboardContent>
    );
  }

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading={product.title}
        backHref={paths.dashboard.product.root}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Productos', href: paths.dashboard.product.root },
          { name: product.title },
        ]}
        action={
          <Button
            component={RouterLink}
            href={paths.dashboard.product.edit(product.id)}
            variant="contained"
            startIcon={<Iconify icon="solar:pen-bold" />}
          >
            Editar
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Grid container spacing={3}>
        {/* Columna izquierda — Info principal */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Avatar
                  src={product.image || ''}
                  alt={product.title}
                  variant="rounded"
                  sx={{
                    width: '100%',
                    maxWidth: 400,
                    maxHeight: 400,
                    aspectRatio: '1 / 1',
                    height: 'auto',
                    bgcolor: 'background.neutral',
                    borderRadius: 2,
                    '& img': { objectFit: 'contain' },
                  }}
                >
                  <Iconify icon="solar:pill-bold" width={64} sx={{ color: 'text.disabled' }} />
                </Avatar>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h5">{product.title}</Typography>
                <Label variant="soft" color={product.is_active ? 'success' : 'default'}>
                  {product.is_active ? 'Activo' : 'Inactivo'}
                </Label>
              </Box>

              {product.description && (
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                  {product.description}
                </Typography>
              )}

              {product.ingredients?.length > 0 && (
                <>
                  <Divider />
                  <Typography variant="subtitle2">Ingredientes activos</Typography>
                  <Stack spacing={0.5}>
                    {product.ingredients.map((item) => (
                      <Typography key={item.ingredient_id} variant="body2">
                        • {item.ingredient?.name} — {item.amount} {item.unit}
                      </Typography>
                    ))}
                  </Stack>
                </>
              )}
            </Stack>
          </Card>
        </Grid>

        {/* Columna derecha — Detalles */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2}>
            <Card sx={{ p: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Detalles
              </Typography>
              <DetailRow label="SKU" value={product.sku} />
              <DetailRow label="Categoría" value={product.category?.name} />
              <DetailRow label="Marca" value={product.brand?.name} />
              <DetailRow label="Unidad" value={product.unit_name} />
              <DetailRow label="Venta por unidad" value={product.is_unit_sale ? 'Sí' : 'No'} />
              {product.allow_warranty && (
                <DetailRow label="Garantía" value={`${product.warranty_days} días`} />
              )}
              <DetailRow label="Creado" value={fDate(product.created_at)} />
            </Card>

            <Card sx={{ p: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Precios
              </Typography>
              <DetailRow label="Precio venta" value={fCurrency(product.price_retail)} />
              {product.price_cost > 0 && (
                <DetailRow label="Precio costo" value={fCurrency(product.price_cost)} />
              )}
            </Card>

            <Card sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle2">
                  {tracksBatches ? 'Lotes y Stock' : 'Stock disponible'}
                </Typography>
                <Button
                  component={RouterLink}
                  href={paths.dashboard.productBatch.new}
                  size="small"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                >
                  {tracksBatches ? 'Agregar lote' : 'Agregar stock'}
                </Button>
              </Box>

              {batchesLoading ? (
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>Cargando…</Typography>
              ) : batches.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Sin stock disponible
                </Typography>
              ) : tracksBatches ? (
                <>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Lote</TableCell>
                          <TableCell align="right">Cantidad</TableCell>
                          <TableCell align="right">Vencimiento</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {batches.map((batch) => {
                          const status = expiryStatus(batch.expiration_date);
                          return (
                            <TableRow key={batch.id}>
                              <TableCell>{batch.lot_code ?? `#${batch.id}`}</TableCell>
                              <TableCell align="right">{batch.quantity} {product.unit_name ?? ''}</TableCell>
                              <TableCell align="right">
                                <Label variant="soft" color={status.color} sx={{ fontSize: '0.7rem' }}>
                                  {status.label}
                                </Label>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                    <Chip
                      size="small"
                      variant="soft"
                      color="primary"
                      label={`Total: ${totalStock} ${product.unit_name ?? 'unidades'}`}
                    />
                  </Box>
                </>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Iconify icon="solar:box-bold" width={20} sx={{ color: 'success.main' }} />
                  <Typography variant="h6">{totalStock}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {product.unit_name ?? 'unidades'} disponibles
                  </Typography>
                </Box>
              )}
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------

function DetailRow({ label, value }) {
  if (!value && value !== 0) return null;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {value}
      </Typography>
    </Box>
  );
}
