import { mutate } from 'swr';
import { z as zod } from 'zod';
import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router';
import { useForm, Controller, FormProvider } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';

import { handleApiError } from 'src/utils/handle-api-error';

import { endpoints } from 'src/lib/axios';
import { createProductBatch, updateProductBatch } from 'src/actions/product-batch';

import { toast } from 'src/components/snackbar';
import { Field } from 'src/components/hook-form';

import { useAllProducts } from './use-all-products';

// ----------------------------------------------------------------------

const todayISO = () => new Date().toLocaleDateString('en-CA');

const schema = zod.object({
  product_id: zod
    .union([zod.string(), zod.number()])
    .refine((v) => v !== '' && Number(v) > 0, { message: 'Selecciona un producto' }),
  expiration_date: zod.string().optional().nullable(),
  quantity: zod.number({ coerce: true }).int().nonnegative('La cantidad no puede ser negativa'),
  lot_code: zod.string().optional(),
  purchase_price: zod.number({ coerce: true }).nonnegative().optional().nullable(),
});

// ----------------------------------------------------------------------

export function ProductBatchCreateEditForm({ currentBatch }) {
  const navigate = useNavigate();
  const products = useAllProducts();
  const isEdit = !!currentBatch;

  // ?product_id=N — pre-selecciona el producto al llegar desde su página de detalle
  const [searchParams] = useSearchParams();
  const prefillProductId = Number(searchParams.get('product_id')) || '';

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      product_id: currentBatch?.product_id ?? prefillProductId,
      expiration_date: currentBatch?.expiration_date ?? '',
      quantity: currentBatch?.quantity ?? 0,
      lot_code: currentBatch?.lot_code ?? '',
      purchase_price: currentBatch?.purchase_price ?? '',
    },
  });

  const { watch, control, setError, setValue, handleSubmit, formState: { isSubmitting } } = methods;

  const productId = watch('product_id');
  const selectedProduct = products.find((p) => p.id === Number(productId));
  const tracksBatches = selectedProduct?.tracks_batches !== false;

  // Pre-fill purchase_price from product's reference cost price when no price is set yet
  useEffect(() => {
    if (selectedProduct != null) {
      const current = methods.getValues('purchase_price');
      if (current === '' || current == null) {
        setValue('purchase_price', selectedProduct.price_cost ?? '', { shouldDirty: !isEdit });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct?.id]);

  const onSubmit = handleSubmit(async (data) => {
    // Validar fecha de vencimiento solo para productos con lotes
    if (tracksBatches) {
      if (!data.expiration_date) {
        setError('expiration_date', { message: 'La fecha de vencimiento es requerida' });
        return;
      }
      if (!isEdit && data.expiration_date < todayISO()) {
        setError('expiration_date', { message: 'La fecha de vencimiento debe ser hoy o una fecha futura' });
        return;
      }
    }

    try {
      const payload = {
        product_id: Number(data.product_id),
        expiration_date: tracksBatches ? data.expiration_date : null,
        quantity: Number(data.quantity),
        lot_code: tracksBatches ? (data.lot_code || null) : null,
        purchase_price: data.purchase_price !== '' && data.purchase_price != null
          ? Number(data.purchase_price)
          : null,
      };

      if (isEdit) {
        await updateProductBatch(currentBatch.id, payload);
      } else {
        await createProductBatch(payload);
      }

      const successMsg = isEdit
        ? (tracksBatches ? 'Lote actualizado' : 'Stock actualizado')
        : (tracksBatches ? 'Lote registrado' : 'Stock registrado');

      toast.success(successMsg);
      mutate((key) => Array.isArray(key) && key[0] === endpoints.productBatch.list);
      navigate(paths.dashboard.productBatch.root);
    } catch (error) {
      if (!handleApiError(error, setError)) {
        toast.error(tracksBatches ? 'Error al guardar el lote' : 'Error al guardar el stock');
      }
    }
  });

  const formTitle = tracksBatches
    ? 'Información del lote'
    : 'Información de stock';

  const submitLabel = isEdit
    ? 'Guardar cambios'
    : (tracksBatches ? 'Registrar lote' : 'Registrar stock');

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit}>
        <Card sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Typography variant="h6">{formTitle}</Typography>
            {productId && (
              <Chip
                size="small"
                label={tracksBatches ? 'Con lote y vencimiento' : 'Solo stock'}
                color={tracksBatches ? 'info' : 'success'}
                variant="soft"
              />
            )}
          </Box>

          <Box
            sx={{
              gap: 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            }}
          >
            <Controller
              name="product_id"
              control={control}
              render={({ field: { value }, fieldState: { error } }) => (
                <Autocomplete
                  options={products}
                  disabled={isEdit}
                  getOptionLabel={(opt) =>
                    typeof opt === 'object'
                      ? opt.title
                      : products.find((p) => p.id === Number(opt))?.title ?? ''
                  }
                  isOptionEqualToValue={(opt, val) =>
                    opt.id === (typeof val === 'object' ? val?.id : Number(val))
                  }
                  value={products.find((p) => p.id === Number(value)) ?? null}
                  onChange={(_, newValue) =>
                    setValue('product_id', newValue ? newValue.id : '', { shouldValidate: true })
                  }
                  noOptionsText="Sin resultados"
                  sx={{ gridColumn: { sm: 'span 2' } }}
                  renderOption={(props, option) => {
                    // key por id: MUI mete el título como key dentro de props y hay títulos duplicados
                    // en el catálogo, lo que rompe la reconciliación y deja opciones viejas en el listbox
                    const { key: _key, ...optionProps } = props;
                    return (
                      <li key={option.id} {...optionProps}>
                        {option.title}
                      </li>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Producto *"
                      placeholder="Escribe para buscar…"
                      error={!!error}
                      helperText={error?.message}
                    />
                  )}
                />
              )}
            />

            {tracksBatches && (
              <>
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
              </>
            )}

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
              helperText="Precio real pagado en esta compra. Se pre-rellena con el precio base del producto — modifícalo si esta compra tuvo un costo distinto."
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
            <Button type="submit" variant="contained" loading={isSubmitting}>
              {submitLabel}
            </Button>
          </Box>
        </Card>
      </form>
    </FormProvider>
  );
}
