import { useState } from 'react';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { fCurrency } from 'src/utils/format-number';

import { useGetSaleDetails } from 'src/actions/sale';

// ----------------------------------------------------------------------

// Lo vendido en una venta, en un desplegable desde la lista (sin ir al detalle)
export function SaleItemsButton({ saleId, productMap }) {
  const [anchor, setAnchor] = useState(null);

  return (
    <>
      <Button
        size="small"
        color="inherit"
        aria-label={`Productos de la venta ${saleId}`}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        Ver ▾
      </Button>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: { role: 'dialog', 'aria-label': `Venta ${saleId}`, sx: { p: 2, minWidth: 260 } },
        }}
      >
        {/* solo pide los productos al abrir */}
        {anchor && <SaleItems saleId={saleId} productMap={productMap} />}
      </Popover>
    </>
  );
}

function SaleItems({ saleId, productMap }) {
  const { saleDetails, saleDetailsLoading } = useGetSaleDetails(saleId);

  if (saleDetailsLoading) return <CircularProgress size={20} />;
  if (!saleDetails.length) return <Typography variant="body2">Sin productos</Typography>;

  return (
    <Stack component="ul" spacing={1} sx={{ m: 0, p: 0, listStyle: 'none' }}>
      {saleDetails.map((d) => (
        <Stack
          key={d.id}
          component="li"
          direction="row"
          sx={{ gap: 2, justifyContent: 'space-between' }}
        >
          <Typography variant="body2">
            {d.quantity}× {productMap[d.product_id] ?? `Producto #${d.product_id}`}
          </Typography>
          <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {fCurrency(Number(d.quantity) * Number(d.price_unit ?? 0) - Number(d.discount ?? 0))}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}
