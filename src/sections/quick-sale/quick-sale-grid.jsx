import { useMemo } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import { fCurrency } from 'src/utils/format-number';

// ----------------------------------------------------------------------

// Mismas palabras que la venta normal (BLOCKED_STATUS en sale-create-edit-form)
const BLOCKED = { reserved: 'Reservado', deceased: 'Murió', not_for_sale: 'No está en venta' };

// Sin iconos a propósito: Iconify pide a internet los que no están
// registrados, y esta pantalla tiene que verse igual sin red.
function ProductButton({ item, left, onAdd }) {
  const blocked = BLOCKED[item.blocked_reason];
  const soldOut = left === 0;
  const disabled = Boolean(blocked) || soldOut;
  const note = blocked ?? (soldOut ? 'Agotado' : left === null ? null : `Quedan ${left}`);

  return (
    <ButtonBase
      onClick={() => onAdd(item)}
      disabled={disabled}
      aria-label={[`Agregar ${item.title}`, fCurrency(item.price_retail), note]
        .filter(Boolean)
        .join(', ')}
      sx={{
        minHeight: 132,
        p: 1,
        gap: 0.5,
        borderRadius: 1.5,
        textAlign: 'left',
        alignItems: 'stretch',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        transition: 'border-color 120ms, transform 120ms',
        '&:active': { transform: 'scale(0.97)' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
        '@media (hover: hover)': { '&:hover': { borderColor: 'text.primary' } },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        '&.Mui-disabled': { opacity: 0.45 },
      }}
    >
      {item.image ? (
        <Box
          component="img"
          src={item.image}
          alt=""
          loading="lazy"
          sx={{ width: 1, height: 72, objectFit: 'cover', borderRadius: 1 }}
        />
      ) : (
        <Box sx={{ height: 72, borderRadius: 1, bgcolor: 'action.hover' }} />
      )}

      <Typography
        variant="subtitle2"
        sx={{
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {item.title}
      </Typography>

      <Stack
        direction="row"
        sx={{ mt: 'auto', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}
      >
        <Typography variant="subtitle1" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {fCurrency(item.price_retail)}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: disabled ? 'error.main' : 'text.secondary', textAlign: 'right' }}
        >
          {[item.is_bundle && !disabled ? 'Paquete' : null, note].filter(Boolean).join(' · ')}
        </Typography>
      </Stack>
    </ButtonBase>
  );
}

// ----------------------------------------------------------------------

export function QuickSaleGrid({ items, stockOf, onAdd }) {
  // El catálogo ya viene ordenado por categoría y nombre
  const groups = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const key = item.category ?? 'Otros';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return [...map];
  }, [items]);

  return (
    <Stack spacing={3}>
      {groups.map(([category, list]) => (
        <Box key={category} component="section" aria-label={category}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            {category}
          </Typography>
          <Box
            sx={{
              mt: 1,
              gap: 1.5,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
            }}
          >
            {list.map((item) => (
              <ProductButton key={item.id} item={item} left={stockOf(item)} onAdd={onAdd} />
            ))}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
