import { useState } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fCurrency } from 'src/utils/format-number';
import { handleApiError } from 'src/utils/handle-api-error';

import { updateProduct } from 'src/actions/product';
import { useGetSuppliers } from 'src/actions/supplier';
import { DashboardContent } from 'src/layouts/dashboard';
import { keepProvisional, useGetProvisionals, discardProvisional } from 'src/actions/convention';

import { toast } from 'src/components/snackbar';

// ----------------------------------------------------------------------

// Productos que se crearon al vuelo en la venta rápida (algo que nadie dio de
// alta). Aquí se decide: completarlo y dejarlo en el catálogo, o desecharlo.
export function ProductProvisionalView() {
  const router = useRouter();
  const { provisionals, provisionalsLoading, provisionalsMutate } = useGetProvisionals();
  const { suppliers } = useGetSuppliers({ pageSize: 100 });
  const [busy, setBusy] = useState(null);

  const pending = provisionals.filter((p) => p.is_active);

  // Se dio de alta como propio y era de un proveedor (o al revés): el corte
  // por dueño lee el dueño actual del producto, así que se corrige solo
  const changeOwner = async (product, value) => {
    setBusy(product.id);
    try {
      await updateProduct(product.id, { consignor_id: value === '' ? null : Number(value) });
      await provisionalsMutate();
      toast.success('Dueño actualizado');
    } catch (error) {
      handleApiError(error, 'No se pudo cambiar el dueño');
    } finally {
      setBusy(null);
    }
  };

  const keep = async (product) => {
    setBusy(product.id);
    try {
      await keepProvisional(product.id);
      router.push(paths.dashboard.product.edit(product.id));
    } catch (error) {
      handleApiError(error, 'No se pudo conservar el producto');
      setBusy(null);
    }
  };

  const discard = async (product) => {
    const sure = window.confirm(
      `¿Desechar «${product.title}»? Deja de venderse; sus ventas quedan en el historial.`
    );
    if (!sure) return;
    setBusy(product.id);
    try {
      await discardProvisional(product.id);
      await provisionalsMutate();
      toast.success('Producto desechado');
    } catch (error) {
      handleApiError(error, 'No se pudo desechar el producto');
    } finally {
      setBusy(null);
    }
  };

  return (
    <DashboardContent>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4">Productos por revisar</Typography>
        <Typography variant="body2" sx={{ maxWidth: 640, color: 'text.secondary' }}>
          Se crearon en la venta rápida con «+ Producto temporal». Completa los que se quedan en el
          catálogo (categoría, costo, foto, existencias) o desecha los que no.
        </Typography>
      </Stack>

      {!provisionalsLoading && pending.length === 0 ? (
        <Typography variant="body2" sx={{ py: 8, color: 'text.secondary', textAlign: 'center' }}>
          No hay productos por revisar
        </Typography>
      ) : (
        <Card>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Producto</TableCell>
                <TableCell>De quién es</TableCell>
                <TableCell align="right">Precio</TableCell>
                <TableCell align="right">Vendidos</TableCell>
                <TableCell align="right">Importe</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {pending.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Typography variant="subtitle2">{product.title}</Typography>
                    {product.needs_prep && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Se prepara al momento
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={product.consignor_id ?? ''}
                      disabled={busy === product.id}
                      onChange={(e) => changeOwner(product, e.target.value)}
                      slotProps={{
                        select: { native: true },
                        htmlInput: { 'aria-label': `De quién es ${product.title}` },
                      }}
                    >
                      <option value="">Propio</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell align="right">{fCurrency(product.price_retail)}</TableCell>
                  <TableCell align="right">{product.units_sold}</TableCell>
                  <TableCell align="right">{fCurrency(product.amount) || '$0'}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" sx={{ gap: 1, justifyContent: 'flex-end' }}>
                      <Button
                        size="small"
                        color="error"
                        disabled={busy === product.id}
                        onClick={() => discard(product)}
                      >
                        Desechar
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={busy === product.id}
                        onClick={() => keep(product)}
                      >
                        Completar y conservar
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </DashboardContent>
  );
}
