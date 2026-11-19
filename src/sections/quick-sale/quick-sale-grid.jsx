import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';

import { fCurrency } from 'src/utils/format-number';

// ----------------------------------------------------------------------

// Mismas palabras que la venta normal (BLOCKED_STATUS en sale-create-edit-form)
const BLOCKED = { reserved: 'Reservado', deceased: 'Murió', not_for_sale: 'No está en venta' };

const SEX = { unknown: 'Sin sexar', female: 'Hembra', male: 'Macho' };
const SEX_ORDER = ['unknown', 'female', 'male'];

// Estado de un producto en la pantalla: bloqueado, agotado o cuántos quedan
const statusOf = (item, left) => {
  const blocked = BLOCKED[item.blocked_reason];
  const soldOut = left === 0;
  return {
    disabled: Boolean(blocked) || soldOut,
    note: blocked ?? (soldOut ? 'Agotado' : left === null ? null : `Quedan ${left}`),
  };
};

// Animales de la misma especie y variedad van en un solo botón
const groupKey = (item) =>
  item.animal?.species
    ? `a:${item.animal.species.id}:${(item.animal.morphs ?? [])
        .map((m) => m.id)
        .sort()
        .join(',')}`
    : `p:${item.id}`;

const groupName = ({ species, morphs = [] }) =>
  [
    species.common_name ?? [species.genus?.name, species.name].filter(Boolean).join(' '),
    ...morphs.map((m) => m.name),
  ].join(' ');

// Por pieza: el sexo del lote. Individual: el ejemplar (código, sexo, año)
const optionLabel = ({ animal }) =>
  animal.species?.sale_format === 'piece'
    ? (SEX[animal.sex] ?? animal.sex)
    : [animal.code, SEX[animal.sex], animal.birth_date?.slice(0, 4)].filter(Boolean).join(' · ');

const optionOrder = (a, b) =>
  a.animal.species?.sale_format === 'piece'
    ? SEX_ORDER.indexOf(a.animal.sex) - SEX_ORDER.indexOf(b.animal.sex)
    : String(a.animal.code).localeCompare(String(b.animal.code));

// Sin iconos a propósito: Iconify pide a internet los que no están
// registrados, y esta pantalla tiene que verse igual sin red.
function Tile({ title, image, price, note, extra, disabled, ariaLabel, onClick }) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
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
      {image ? (
        <Box
          component="img"
          src={image}
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
        {title}
      </Typography>

      <Stack
        direction="row"
        sx={{ mt: 'auto', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}
      >
        <Typography variant="subtitle1" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {price}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: disabled ? 'error.main' : 'text.secondary', textAlign: 'right' }}
        >
          {[extra, note].filter(Boolean).join(' · ')}
        </Typography>
      </Stack>
    </ButtonBase>
  );
}

function ProductButton({ item, left, onAdd }) {
  const { disabled, note } = statusOf(item, left);
  return (
    <Tile
      title={item.title}
      image={item.image}
      price={fCurrency(item.price_retail)}
      note={note}
      extra={item.is_bundle && !disabled ? 'Paquete' : null}
      disabled={disabled}
      ariaLabel={[`Agregar ${item.title}`, fCurrency(item.price_retail), note]
        .filter(Boolean)
        .join(', ')}
      onClick={() => onAdd(item)}
    />
  );
}

// Varios lotes (por sexo) o ejemplares de la misma especie y variedad: un
// botón; al tocarlo se elige cuál. Así 20 insectos hoja no tapan lo demás.
function GroupButton({ items, stockOf, onAdd }) {
  const [open, setOpen] = useState(false);
  const name = groupName(items[0].animal);
  const options = [...items].sort(optionOrder);
  const open_ = options.filter((item) => !statusOf(item, stockOf(item)).disabled);
  const left = open_.reduce((sum, item) => sum + (stockOf(item) ?? 0), 0);
  const from = Math.min(...(open_.length ? open_ : options).map((i) => Number(i.price_retail)));
  const note = open_.length ? `Quedan ${left}` : 'Agotado';

  return (
    <>
      <Tile
        title={name}
        image={items[0].image}
        price={`desde ${fCurrency(from)}`}
        note={note}
        disabled={!open_.length}
        ariaLabel={`Elegir ${name}, desde ${fCurrency(from)}, ${note}`}
        onClick={() => setOpen(true)}
      />
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{name}</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ pb: 1 }}>
            {options.map((item) => {
              const { disabled, note: status } = statusOf(item, stockOf(item));
              const label = optionLabel(item);
              return (
                <ButtonBase
                  key={item.id}
                  disabled={disabled}
                  aria-label={[`Agregar ${label}`, fCurrency(item.price_retail), status]
                    .filter(Boolean)
                    .join(', ')}
                  onClick={() => {
                    onAdd(item);
                    setOpen(false);
                  }}
                  sx={{
                    p: 1,
                    gap: 1.5,
                    width: 1,
                    borderRadius: 1.5,
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    border: '1px solid',
                    borderColor: 'divider',
                    '@media (hover: hover)': { '&:hover': { borderColor: 'text.primary' } },
                    '&.Mui-disabled': { opacity: 0.45 },
                  }}
                >
                  {item.image && (
                    <Box
                      component="img"
                      src={item.image}
                      alt=""
                      sx={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 1 }}
                    />
                  )}
                  <Typography variant="subtitle2" sx={{ flex: 1 }}>
                    {label}
                  </Typography>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="subtitle2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fCurrency(item.price_retail)}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: disabled ? 'error.main' : 'text.secondary' }}
                    >
                      {status}
                    </Typography>
                  </Box>
                </ButtonBase>
              );
            })}
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ----------------------------------------------------------------------

// Dividida por dueño (consignor_id): lo mío primero y luego cada proveedor,
// cada parte bajo un divisor con su nombre. Con un solo dueño no hay divisor.
export function QuickSaleGrid({ items, stockOf, onAdd, suppliers = [], businessName }) {
  const parts = useMemo(() => {
    const owners = [...new Set(items.map((item) => item.consignor_id ?? null))].sort(
      (a, b) => (a !== null) - (b !== null)
    );
    return owners.map((owner) => ({
      owner,
      name:
        owner === null
          ? businessName || 'Míos'
          : (suppliers.find((s) => s.id === owner)?.name ?? 'Otro vendedor'),
      items: items.filter((item) => (item.consignor_id ?? null) === owner),
    }));
  }, [items, suppliers, businessName]);

  if (parts.length < 2) return <CategoryGroups items={items} stockOf={stockOf} onAdd={onAdd} />;
  return (
    <Stack spacing={4}>
      {parts.map((part) => (
        <Box key={part.owner ?? 'mine'} component="section" aria-label={part.name}>
          <Divider textAlign="left" sx={{ mb: 2, typography: 'subtitle1' }}>
            {part.name}
          </Divider>
          <CategoryGroups items={part.items} stockOf={stockOf} onAdd={onAdd} />
        </Box>
      ))}
    </Stack>
  );
}

function CategoryGroups({ items, stockOf, onAdd }) {
  // El catálogo ya viene ordenado por categoría y nombre; dentro de cada
  // categoría, los animales iguales (especie y variedad) van juntos
  const groups = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const category = item.category ?? 'Otros';
      if (!map.has(category)) map.set(category, new Map());
      const tiles = map.get(category);
      const key = groupKey(item);
      if (!tiles.has(key)) tiles.set(key, []);
      tiles.get(key).push(item);
    });
    return [...map].map(([category, tiles]) => [category, [...tiles.values()]]);
  }, [items]);

  return (
    <Stack spacing={3}>
      {groups.map(([category, tiles]) => (
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
            {tiles.map((tile) =>
              tile.length === 1 ? (
                <ProductButton
                  key={tile[0].id}
                  item={tile[0]}
                  left={stockOf(tile[0])}
                  onAdd={onAdd}
                />
              ) : (
                <GroupButton key={groupKey(tile[0])} items={tile} stockOf={stockOf} onAdd={onAdd} />
              )
            )}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
