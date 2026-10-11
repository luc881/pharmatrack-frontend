import * as z from 'zod';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller, FormProvider, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';

import { handleApiError } from 'src/utils/handle-api-error';

import { createProductCategory } from 'src/actions/product-category';
import { createProduct, useGetProductCategories } from 'src/actions/product';

import { toast } from 'src/components/snackbar';
import { Field } from 'src/components/hook-form';
import { Iconify } from 'src/components/iconify';

import { InlineCreatableSelect } from './inline-creatable-select';
import { useAllProducts, useAddToAllProducts } from '../product-batch/use-all-products';

// ----------------------------------------------------------------------

const price = (msg) =>
  z.union([z.string(), z.number()]).refine((v) => v !== '' && v != null && Number(v) >= 0, {
    message: msg,
  });

const QuickSchema = z.object({
  title: z.string().trim().min(1, { message: 'Escribe el nombre' }),
  product_category_id: z
    .union([z.string(), z.number()])
    .refine((v) => Number(v) > 0, { message: 'Elige o crea una categoría' }),
  price_retail: price('Precio de venta requerido'),
  price_cost: price('Costo requerido'),
  sku: z.string(),
  tracks_batches: z.boolean(),
});

const money = {
  inputLabel: { shrink: true },
  input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
};

// Lo mínimo para dar de alta un producto sin salir de la compra o del lote.
// Sin <form>: el diálogo vive dentro del formulario de afuera y un submit aquí
// burbujearía hasta él por el árbol de React.
function ProductQuickCreateDialog({ open, onClose, onCreated }) {
  const { categories, categoriesLoading, categoriesMutate } = useGetProductCategories();

  const methods = useForm({
    resolver: zodResolver(QuickSchema),
    defaultValues: {
      title: '',
      product_category_id: '',
      price_retail: '',
      price_cost: '',
      sku: '',
      tracks_batches: true,
    },
  });
  const {
    setError,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const handleCreateCategory = async (name) => {
    const created = await createProductCategory({ name, is_active: true });
    categoriesMutate();
    toast.success(`Categoría "${created.name}" creada`);
    return created;
  };

  const onSave = handleSubmit(async (data) => {
    try {
      const created = await createProduct({
        title: data.title.trim(),
        product_category_id: Number(data.product_category_id),
        price_retail: Number(data.price_retail),
        price_cost: Number(data.price_cost),
        sku: data.sku.trim() || null,
        tracks_batches: data.tracks_batches,
      });
      toast.success(`Producto "${created.title}" creado`);
      onCreated(created);
    } catch (error) {
      if (!handleApiError(error, setError)) toast.error(error?.message || 'No se pudo crear');
    }
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Producto nuevo</DialogTitle>
      <DialogContent>
        <FormProvider {...methods}>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Field.Text name="title" label="Nombre *" autoFocus />
            <InlineCreatableSelect
              name="product_category_id"
              label="Categoría *"
              newLabel="Categoría nueva"
              options={categories}
              onCreate={handleCreateCategory}
              loading={categoriesLoading}
            />
            <Box
              sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}
            >
              <Field.Text
                name="price_retail"
                label="Precio de venta *"
                type="number"
                slotProps={money}
              />
              <Field.Text name="price_cost" label="Costo *" type="number" slotProps={money} />
            </Box>
            <Field.Text name="sku" label="Código / SKU (opcional)" />
            <Field.Switch
              name="tracks_batches"
              label="Tiene lote y fecha de vencimiento"
              helperText="Apágalo si solo cuentas piezas (sin caducidad)."
            />
            <Typography variant="caption" color="text.secondary">
              Foto, marca y descripción se agregan después en Productos.
            </Typography>
          </Stack>
        </FormProvider>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="contained" loading={isSubmitting} onClick={onSave}>
          Crear producto
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

// Buscador de productos con «+ Producto nuevo» a la vista; el creado queda elegido.
export function ProductSelect({ name, label = 'Producto *', size, disabled, sx }) {
  const { control, setValue } = useFormContext();
  const products = useAllProducts();
  const addToAllProducts = useAddToAllProducts();
  const [creating, setCreating] = useState(false);

  return (
    <Box
      sx={[
        {
          display: 'flex',
          gap: 1,
          alignItems: 'flex-start',
          flexWrap: { xs: 'wrap', sm: 'nowrap' },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Controller
        name={name}
        control={control}
        render={({ field: { value }, fieldState: { error } }) => (
          <Autocomplete
            size={size}
            disabled={disabled}
            sx={{ flex: '1 1 220px', minWidth: 0 }}
            options={products}
            value={products.find((p) => p.id === Number(value)) ?? null}
            onChange={(_, p) => setValue(name, p ? p.id : '', { shouldValidate: true })}
            getOptionLabel={(p) => p.title ?? ''}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            // key por id: hay títulos duplicados en el catálogo
            getOptionKey={(p) => p.id}
            noOptionsText="No está en la lista: usa «Producto nuevo»"
            renderInput={(params) => (
              <TextField
                {...params}
                label={label}
                placeholder="Escribe para buscar…"
                error={!!error}
                helperText={error?.message}
              />
            )}
          />
        )}
      />
      {!disabled && (
        <Button
          variant="outlined"
          startIcon={<Iconify icon="eva:plus-fill" />}
          onClick={() => setCreating(true)}
          sx={{ height: size === 'small' ? 40 : 56, flexShrink: 0, width: { xs: 1, sm: 'auto' } }}
        >
          Producto nuevo
        </Button>
      )}
      {creating && (
        <ProductQuickCreateDialog
          open
          onClose={() => setCreating(false)}
          onCreated={(product) => {
            addToAllProducts(product);
            setValue(name, product.id, { shouldValidate: true });
            setCreating(false);
          }}
        />
      )}
    </Box>
  );
}
