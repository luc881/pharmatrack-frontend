import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';

// ----------------------------------------------------------------------

const when = (iso) =>
  new Date(iso).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const signInHref = `${paths.auth.jwt.signIn}?${new URLSearchParams({
  returnTo: paths.dashboard.quickSale.root,
})}`;

// Estado del dispositivo: si está listo para vender sin internet, cuántas
// ventas faltan por subir y cuáles rechazó el servidor.
export function QuickSaleStatus({
  online,
  reachable = true,
  shellReady = true,
  count,
  fetchedAt,
  counts,
  sales,
  needsLogin,
  preparing,
  syncing,
  onPrepare,
  onSync,
  onRetry,
  onDiscard,
  onBackup,
}) {
  const review = sales.filter((s) => s.status === 'review');
  const waiting = counts.pending + counts.review;

  return (
    <Card sx={{ p: 2, mb: 3 }}>
      <Stack
        direction="row"
        sx={{ gap: 2, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Box>
          <Typography variant="subtitle2">
            {!online && 'Sin conexión: las ventas se guardan en este equipo'}
            {online &&
              !reachable &&
              'Sin conexión con el sistema: las ventas se guardan en este equipo'}
            {online && reachable && 'Con conexión'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {!fetchedAt && 'Este equipo aún no está preparado para vender sin internet'}
            {fetchedAt &&
              !shellReady &&
              'La app todavía se está guardando en este equipo. Espera a que termine antes de cerrar o salir.'}
            {fetchedAt &&
              shellReady &&
              `Listo para vender sin internet · ${count} productos · preparado ${when(fetchedAt)}`}
          </Typography>
        </Box>
        <Button variant="outlined" disabled={!online} loading={preparing} onClick={onPrepare}>
          Preparar para vender sin internet
        </Button>
      </Stack>

      {waiting > 0 && (
        <Alert severity={counts.review ? 'warning' : 'info'} icon={false} sx={{ mt: 2 }}>
          <Typography variant="subtitle2">
            {[
              counts.pending ? `${counts.pending} por subir` : null,
              counts.review ? `${counts.review} por revisar` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
          <Typography variant="body2">
            Hay ventas que solo existen en este equipo. No borres los datos del navegador hasta que
            se suban.
          </Typography>
          {needsLogin && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              <Link component={RouterLink} href={signInHref}>
                Inicia sesión para subir las ventas
              </Link>
            </Typography>
          )}
          <Stack direction="row" sx={{ mt: 1, gap: 1, flexWrap: 'wrap' }}>
            {counts.pending > 0 && (
              <Button size="small" variant="contained" loading={syncing} onClick={onSync}>
                Subir ahora
              </Button>
            )}
            <Button size="small" variant="outlined" color="inherit" onClick={onBackup}>
              Descargar respaldo
            </Button>
          </Stack>
        </Alert>
      )}

      {review.length > 0 && (
        <Stack component="ul" spacing={1} sx={{ m: 0, mt: 2, p: 0, listStyle: 'none' }}>
          {review.map((sale) => (
            <Stack
              key={sale.idempotency_key}
              component="li"
              direction="row"
              sx={{ gap: 2, alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Box>
                <Typography variant="subtitle2">
                  {sale.folio} · {fCurrency(sale.totals.total)}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {sale.reason}
                </Typography>
              </Box>
              <Stack direction="row" sx={{ gap: 1, flexShrink: 0 }}>
                {!sale.sale_id && (
                  <Button size="small" color="error" onClick={() => onDiscard(sale)}>
                    Descartar
                  </Button>
                )}
                <Button size="small" variant="outlined" onClick={() => onRetry(sale)}>
                  {sale.sale_id ? 'Ya la revisé' : 'Reintentar'}
                </Button>
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------

// Precios que un admin cambió al cobrar: con red se decide si el nuevo queda
// como precio del producto (también en el sitio) o fue solo para esa venta.
// Se queda en el equipo hasta decidir.
export function QuickSalePriceReview({ items, online, busy, onResolve }) {
  if (!items.length) return null;
  return (
    <Card component="section" aria-label="Precios cambiados" sx={{ p: 2, mb: 3 }}>
      <Typography variant="subtitle2">
        {items.length === 1 ? '1 precio cambiado' : `${items.length} precios cambiados`} al cobrar
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {online
          ? 'Elige si el precio nuevo queda en el sistema (y en el sitio) o fue solo para esa venta.'
          : 'Cuando vuelva el internet podrás decidir si el precio nuevo queda en el sistema.'}
      </Typography>
      <Stack component="ul" spacing={1.5} sx={{ m: 0, mt: 1.5, p: 0, listStyle: 'none' }}>
        {items.map((entry) => (
          <Stack
            key={entry.product_id}
            component="li"
            direction="row"
            sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Box>
              <Typography variant="subtitle2">{entry.title}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Sistema {fCurrency(entry.catalog_price) || '$0'} · vendido a{' '}
                {entry.prices.map((p) => fCurrency(p) || '$0').join(', ')}
              </Typography>
            </Box>
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              {entry.prices.map((price) => (
                <Button
                  key={price}
                  size="small"
                  variant="contained"
                  disabled={!online || busy}
                  onClick={() => onResolve(entry, price)}
                >
                  Guardar {fCurrency(price) || '$0'} como precio
                </Button>
              ))}
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                disabled={busy}
                onClick={() => onResolve(entry, null)}
              >
                Dejar {fCurrency(entry.catalog_price) || '$0'}
              </Button>
            </Stack>
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}
