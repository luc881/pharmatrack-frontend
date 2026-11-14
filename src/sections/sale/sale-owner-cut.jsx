import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';

import { fCurrency } from 'src/utils/format-number';

import { useOwnerCut } from 'src/actions/convention';

// ----------------------------------------------------------------------

// Corte por dueño: lo vendido de cada quien (propio y en consigna) aunque
// vaya mezclado en un mismo ticket. Solo aparece si se vendió algo ajeno.
export function SaleOwnerCut({ from, to }) {
  const { cut } = useOwnerCut({ from, to });

  if (!cut.some((owner) => owner.consignor_id !== null)) return null;

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6">Por dueño</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Importe de cada línea, ya con su descuento. No reparte por forma de pago: en un ticket
          mezclado un solo pago cubre a los dos.
        </Typography>
      </Box>

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
        }}
      >
        {cut.map((owner) => (
          <Card
            key={owner.consignor_id ?? 'own'}
            component="section"
            aria-label={owner.owner}
            sx={{ p: 3 }}
          >
            <Stack
              direction="row"
              sx={{ mb: 2, gap: 2, alignItems: 'baseline', justifyContent: 'space-between' }}
            >
              <Typography variant="subtitle1">{owner.owner}</Typography>
              <Typography variant="h5">{fCurrency(owner.amount)}</Typography>
            </Stack>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Producto</TableCell>
                  <TableCell align="right">Cant.</TableCell>
                  <TableCell align="right">Importe</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {owner.products.map((row) => (
                  <TableRow key={row.product_id}>
                    <TableCell>{row.title}</TableCell>
                    <TableCell align="right">{row.units}</TableCell>
                    <TableCell align="right">{fCurrency(row.amount) || '$0'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ))}
      </Box>
    </Stack>
  );
}
