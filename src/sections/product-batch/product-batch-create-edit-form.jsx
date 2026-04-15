import { mutate } from 'swr';
import { z as zod } from 'zod';
import { useNavigate } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';

import { endpoints } from 'src/lib/axios';
import { createProductBatch, updateProductBatch } from 'src/actions/product-batch';

import { handleApiError } from 'src/utils/handle-api-error';

import { toast } from 'src/components/snackbar';
import { Field } from 'src/components/hook-form';

import { useAllProducts } from './use-all-products';

// ----------------------------------------------------------------------

const todayISO = () => new Date().toLocaleDateString('en-CA');

const baseSchema = zod.object({
  product_id: zod
    .union([zod.string(), zod.number()])
    .refine((v) => v !== '' && Number(v) > 0, { message: 'Selecciona un producto' }),
  expiration_date: zod.string().min(1, 'La fecha de vencimiento es requerida'),
  quantity: zod.number({ coerce: true }).int().nonnegative('La cantidad no puede ser negativa'),
  lot_code: zod.string().optional(),
  purchase_price: zod.number({ coerce: true }).nonnegative().optional().nullable(),
});

const createSchema = baseSchema.extend({
  expiration_date: zod
    .string()
    .min(1, 'La fecha de vencimiento es requerida')
    .refine((v) => v >= todayISO(), {
      message: 'La fecha de vencimiento debe ser hoy o una fecha futura',
    }),
});

// ----------------------------------------------------------------------

export function ProductBatchCreateEditForm({ currentBatch }) {
  const navigate = useNavigate();
  const products = useAllProducts();
  const isEdit = !!currentBatch;
  const schema = isEdit ? baseSchema : createSchema;

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      product_id: currentBatch?.product_id ?? '',
      expiration_date: currentBatch?.expiration_date ?? '',
      quantity: currentBatch?.quantity ?? 0,
      lot_code: currentBatch?.lot_code ?? '',
      purchase_price: currentBatch?.purchase_price ?? '',
    },
  });

  const { setError, handleSubmit, formState: { isSubmitting } } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = {
        product_id: Number(data.product_id),
        expiration_date: data.expiration_date,
        quantity: Number(data.quantity),
        lot_code: data.lot_code || null,
        purchase_price: data.purchase_price !== '' && data.purchase_price != null
          ? Number(data.purchase_price)
          : null,
      };

      if (isEdit) {
        await updateProductBatch(currentBatch.id, payload);
      } else {
        await createProductBatch(payload);
      }

      toast.success(isEdit ? 'Lote actualizado' : 'Lote registrado');
      mutate((key) => Array.isArray(key) && key[0] === endpoints.productBatch.list);
      navigate(paths.dashboard.productBatch.root);
    } catch (error) {
      if (!handleApiError(error, setError)) {
        toast.error('Error al guardar el lote');
      }
    }
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Información del lote
          </Typography>

          <Box
            sx={{
              gap: 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            }}
          >
            <Field.Select
              name="product_id"
              label="Producto *"
              disabled={isEdit}
              sx={{ gridColumn: { sm: 'span 2' } }}
            >
              {products.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.title}
                </MenuItem>
              ))}
            </Field.Select>

            <Field.Text
              name="lot_code"
              label="Código de lote"
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <Field.Text
              name="expiration_date"
              label="Fecha de vencimiento *"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <Field.Text
              name="quantity"
              label="Cantidad *"
              type="number"
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <Field.Text
              name="purchase_price"
              label="Precio de compra"
              type="number"
              slotProps={{
                inputLabel: { shrink: true },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box sx={{ typography: 'subtitle2', color: 'text.disabled' }}>$</Box>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
              {isEdit ? 'Guardar cambios' : 'Registrar lote'}
            </LoadingButton>
          </Box>
        </Card>
      </form>
    </FormProvider>
  );
}
