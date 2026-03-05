import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Avatar from '@mui/material/Avatar';
import ListItemText from '@mui/material/ListItemText';

import { RouterLink } from 'src/routes/components';

import { fDate } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

import { Label } from 'src/components/label';

// ----------------------------------------------------------------------

export function RenderCellPrice({ params }) {
  return fCurrency(params.row.price_retail);
}

export function RenderCellPriceCost({ params }) {
  return fCurrency(params.row.price_cost);
}

export function RenderCellStatus({ params }) {
  return (
    <Label variant="soft" color={params.row.is_active ? 'success' : 'default'}>
      {params.row.is_active ? 'Activo' : 'Inactivo'}
    </Label>
  );
}

export function RenderCellCreatedAt({ params }) {
  return <span>{fDate(params.row.created_at)}</span>;
}

export function RenderCellProduct({ params, href, categoryName }) {
  return (
    <Box sx={{ py: 2, gap: 2, width: 1, display: 'flex', alignItems: 'center' }}>
      <Avatar
        alt={params.row.title}
        src={params.row.image}
        variant="rounded"
        sx={{ width: 52, height: 52 }}
      >
        {params.row.title?.[0]}
      </Avatar>

      <ListItemText
        primary={
          <Link component={RouterLink} href={href} color="inherit">
            {params.row.title}
          </Link>
        }
        secondary={categoryName}
        slotProps={{
          primary: { noWrap: true },
          secondary: { sx: { color: 'text.disabled' } },
        }}
      />
    </Box>
  );
}
