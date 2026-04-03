import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDate } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------

export function ProductDetailsView({ product, error, loading }) {
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

            {product.batches?.length > 0 && (
              <Card sx={{ p: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  Lotes en stock
                </Typography>
                {product.batches.map((batch) => (
                  <DetailRow
                    key={batch.id}
                    label={`Lote ${batch.batch_number}`}
                    value={`${batch.quantity_available} ${product.unit_name}`}
                  />
                ))}
              </Card>
            )}
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
