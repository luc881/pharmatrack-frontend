import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';

import { matchesWords } from 'src/utils/plain';

import { useGetSuppliers } from 'src/actions/supplier';
import { useGetProductCategories } from 'src/actions/product';

import { Label } from 'src/components/label';

import { DiscountPrice } from '../discount/bulk-discount-dialog';

// ----------------------------------------------------------------------

// Dueño: '' todos · 'mine' los míos · 'others' de cualquier proveedor · id de uno
const ownerTest = (owner) => (p) => {
  if (owner === '') return true;
  if (owner === 'mine') return !p.consignor_id;
  if (owner === 'others') return Boolean(p.consignor_id);
  return p.consignor_id === Number(owner);
};

// Catálogo para elegir sin acordarse del nombre: todos los productos por
// páginas, con búsqueda por palabras y filtros por dueño y categoría. La lista
// ya está en memoria (la carga la venta), así que filtra aquí mismo.
export function ProductBrowserDialog({
  open,
  products,
  productIdsWithStock,
  blockedProducts,
  inCart,
  onAdd,
  onClose,
}) {
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const { suppliers } = useGetSuppliers({ pageSize: 100 });
  const { categories } = useGetProductCategories();
  const supplierName = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const categoryName = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);

  const noStock = (p) =>
    !!productIdsWithStock && p.tracks_batches !== false && !productIdsWithStock.has(p.id);

  const found = useMemo(
    () =>
      products
        .filter(ownerTest(owner))
        .filter((p) => category === '' || p.product_category_id === Number(category))
        .filter((p) =>
          matchesWords(`${p.title} ${p.sku ?? ''} ${categoryName[p.product_category_id] ?? ''}`, query)
        )
        // con stock primero, luego por nombre
        .sort((a, b) => noStock(a) - noStock(b) || a.title.localeCompare(b.title)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, owner, category, query, categoryName, productIdsWithStock]
  );
  const visible = found.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // cualquier filtro nuevo vuelve a la primera página
  const filter = (set) => (event) => {
    set(event.target.value);
    setPage(0);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Catálogo de productos</DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1, mb: 1.5 }}>
          <TextField
            autoFocus
            type="search"
            size="small"
            label="Buscar"
            placeholder="Nombre, SKU o categoría"
            value={query}
            onChange={filter(setQuery)}
            sx={{ flex: 2 }}
          />
          <TextField
            select
            size="small"
            label="Dueño"
            value={owner}
            onChange={filter(setOwner)}
            sx={{ flex: 1, minWidth: 170 }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="mine">Míos</MenuItem>
            <MenuItem value="others">De otros (no míos)</MenuItem>
            {suppliers.map((s) => (
              <MenuItem key={s.id} value={String(s.id)}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Categoría"
            value={category}
            onChange={filter(setCategory)}
            sx={{ flex: 1, minWidth: 150 }}
          >
            <MenuItem value="">Todas</MenuItem>
            {categories.map((c) => (
              <MenuItem key={c.id} value={String(c.id)}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {found.length === 1 ? '1 producto' : `${found.length} productos`}
        </Typography>

        <TableContainer sx={{ mt: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Producto</TableCell>
                <TableCell>Dueño</TableCell>
                <TableCell>Precio</TableCell>
                <TableCell align="right"> </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((p) => {
                const blocked = blockedProducts.get(p.id);
                const qty = inCart.get(p.id);
                return (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Typography variant="body2">{p.title}</Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {[categoryName[p.product_category_id], p.sku].filter(Boolean).join(' · ')}
                        </Typography>
                        {noStock(p) && <Chip size="small" variant="soft" label="Sin stock" />}
                        {blocked && <Chip size="small" variant="soft" color="warning" label={blocked} />}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {p.consignor_id ? (
                        <Label variant="soft" color="secondary">
                          {supplierName[p.consignor_id] ?? 'Proveedor'}
                        </Label>
                      ) : (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Mío
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <DiscountPrice price={p.price_retail} compareAt={p.compare_at_price} />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant={qty ? 'soft' : 'outlined'}
                        disabled={Boolean(blocked)}
                        onClick={() => onAdd(p)}
                        aria-label={`Agregar ${p.title}`}
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        {qty ? `Agregado (${qty}) +1` : 'Agregar'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={found.length}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[25, 50, 100]}
          onPageChange={(_, next) => setPage(next)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
          labelRowsPerPage="Por página"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
          getItemAriaLabel={(type) => (type === 'next' ? 'Siguiente página' : 'Página anterior')}
        />
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Listo
        </Button>
      </DialogActions>
    </Dialog>
  );
}
