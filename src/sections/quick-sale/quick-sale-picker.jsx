import { useState } from 'react';
import { useDebounce } from 'minimal-shared/hooks';

import List from '@mui/material/List';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import ListItem from '@mui/material/ListItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { fCurrency } from 'src/utils/format-number';

import { useGetProducts, toggleProductQuickSale } from 'src/actions/product';

import { toast } from 'src/components/snackbar';

// ----------------------------------------------------------------------

// «+ Agregar productos»: marca o desmarca cualquier producto (también los
// gemelos de animales) sin salir de la venta rápida. Necesita internet.
export function QuickSalePicker({ onClose }) {
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const { products, productsLoading, productsMutate } = useGetProducts({
    search: debounced,
    pageSize: 30,
    isActive: true,
    ordering: 'title',
  });
  const [busy, setBusy] = useState(null);

  const toggle = async (product) => {
    setBusy(product.id);
    try {
      await toggleProductQuickSale(product.id);
      await productsMutate();
    } catch (error) {
      toast.error(error?.message || 'No se pudo cambiar el producto');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Productos de la venta rápida</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Buscar producto"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mt: 1 }}
        />
        <List>
          {products.map((product) => (
            <ListItem
              key={product.id}
              disableGutters
              secondaryAction={
                <Switch
                  edge="end"
                  checked={Boolean(product.quick_sale)}
                  disabled={busy === product.id}
                  onChange={() => toggle(product)}
                  slotProps={{ input: { 'aria-label': `Venta rápida: ${product.title}` } }}
                />
              }
            >
              <ListItemText primary={product.title} secondary={fCurrency(product.price_retail)} />
            </ListItem>
          ))}
        </List>
        {!productsLoading && products.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Ningún producto coincide con la búsqueda.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Listo
        </Button>
      </DialogActions>
    </Dialog>
  );
}
