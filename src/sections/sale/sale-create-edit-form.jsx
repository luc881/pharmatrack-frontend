import { z as zod } from 'zod';
import { useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider, useFieldArray, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';

import axiosInstance, { endpoints } from 'src/lib/axios';
import {
  createSale,
  updateSale,
  useGetBranches,
  createSaleDetail,
  deleteSaleDetail,
  createSalePayment,
  deleteSalePayment,
} from 'src/actions/sale';

import { toast } from 'src/components/snackbar';
import { Field } from 'src/components/hook-form';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const PAGE_SIZE = 100;

let _productsCache = [];
let _productsLoaded = false;

async function loadAllProducts() {
  if (_productsLoaded) return _productsCache;
  const first = await axiosInstance
    .get(endpoints.product.list, { params: { page: 1, page_size: PAGE_SIZE } })
    .then((r) => r.data);
  let items = first.data;
  if (first.total > PAGE_SIZE) {
    const remaining = Math.ceil(first.total / PAGE_SIZE) - 1;
    const pages = await Promise.all(
      Array.from({ length: remaining }, (_, i) =>
        axiosInstance
          .get(endpoints.product.list, { params: { page: i + 2, page_size: PAGE_SIZE } })
          .then((r) => r.data.data)
      )
    );
    items = [...items, ...pages.flat()];
  }
  _productsCache = items;
  _productsLoaded = true;
  return items;
}

function useAllProducts() {
  const [products, setProducts] = useState(_productsCache);
  useEffect(() => {
    if (!_productsLoaded) {
      loadAllProducts().then(setProducts);
    }
  }, []);
  return products;
}

// ----------------------------------------------------------------------

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
];

const defaultItem = { product_id: '', quantity: 1, discount: 0, description: '' };

const defaultPayment = { method_payment: 'cash', amount: 0, transaction_number: '', bank: '' };

const itemSchema = zod.object({
  product_id: zod
    .union([zod.string(), zod.number()])
    .refine((v) => v !== '' && Number(v) > 0, { message: 'Selecciona un producto' }),
  quantity: zod.number({ coerce: true }).positive('La cantidad debe ser mayor a 0'),
  discount: zod.number({ coerce: true }).nonnegative().default(0),
  description: zod.string().optional(),
});

const paymentSchema = zod.object({
  method_payment: zod.enum(['cash', 'card', 'transfer']),
  amount: zod.number({ coerce: true }).positive('El monto debe ser mayor a 0'),
  transaction_number: zod.string().optional(),
  bank: zod.string().optional(),
});

const schema = zod.object({
  branch_id: zod
    .union([zod.string(), zod.number()])
    .refine((v) => v !== '' && Number(v) > 0, { message: 'Selecciona una sucursal' }),
  description: zod.string().optional(),
  items: zod.array(itemSchema).min(1, 'Agrega al menos un producto'),
  payments: zod.array(paymentSchema).min(1, 'Agrega al menos un pago'),
});

// ----------------------------------------------------------------------

export function SaleCreateEditForm({ currentSale, currentDetails = [], currentPayments = [] }) {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { branches } = useGetBranches();
  const products = useAllProducts();

  const defaultValues = {
    branch_id: currentSale?.branch_id ?? (branches[0]?.id ?? ''),
    description: currentSale?.description ?? '',
    items:
      currentDetails.length > 0
        ? currentDetails.map((d) => ({
            _detailId: d.id,
            product_id: d.product_id,
            quantity: Number(d.quantity),
            discount: Number(d.discount ?? 0),
            description: d.description ?? '',
          }))
        : [defaultItem],
    payments:
      currentPayments.length > 0
        ? currentPayments.map((p) => ({
            _paymentId: p.id,
            method_payment: p.method_payment,
            amount: Number(p.amount),
            transaction_number: p.transaction_number ?? '',
            bank: p.bank ?? '',
          }))
        : [{ ...defaultPayment }],
  };

  const methods = useForm({ resolver: zodResolver(schema), defaultValues });

  const { handleSubmit, setValue, formState: { isSubmitting } } = methods;

  // Auto-fill branch if loaded after init
  useEffect(() => {
    if (!currentSale && branches.length > 0 && methods.getValues('branch_id') === '') {
      setValue('branch_id', branches[0].id);
    }
  }, [branches, currentSale, methods, setValue]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      const salePayload = {
        user_id: user.id,
        branch_id: Number(data.branch_id),
        description: data.description || null,
      };

      let saleId;
      if (currentSale) {
        await updateSale(currentSale.id, salePayload);
        saleId = currentSale.id;
        await Promise.all([
          ...currentDetails.map((d) => deleteSaleDetail(d.id)),
          ...currentPayments.map((p) => deleteSalePayment(p.id)),
        ]);
      } else {
        const created = await createSale(salePayload);
        saleId = created.id;
      }

      await Promise.all(
        data.items.map((item) =>
          createSaleDetail({
            sale_id: saleId,
            product_id: Number(item.product_id),
            quantity: Number(item.quantity),
            discount: Number(item.discount ?? 0),
            description: item.description || null,
          })
        )
      );

      await Promise.all(
        data.payments.map((payment) =>
          createSalePayment({
            sale_id: saleId,
            method_payment: payment.method_payment,
            amount: Number(payment.amount),
            transaction_number: payment.transaction_number || null,
            bank: payment.bank || null,
          })
        )
      );

      toast.success(currentSale ? 'Venta actualizada' : 'Venta registrada');
      navigate(paths.dashboard.sale.root);
    } catch {
      toast.error('Error al guardar la venta');
    }
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit}>
        <Stack spacing={3}>
          {/* Header */}
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Información de la venta
            </Typography>

            <Box
              sx={{
                gap: 2,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              }}
            >
              <Field.Select name="branch_id" label="Sucursal *">
                {branches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.name}
                  </MenuItem>
                ))}
              </Field.Select>

              <Field.Text name="description" label="Observaciones" multiline maxRows={3} />
            </Box>
          </Card>

          {/* Line items */}
          <Card>
            <SaleItems products={products} />
          </Card>

          {/* Payment */}
          <Card>
            <SalePayments />
          </Card>

          {/* Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button variant="outlined" onClick={() => navigate(paths.dashboard.sale.root)}>
              Cancelar
            </Button>
            <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
              {currentSale ? 'Guardar cambios' : 'Registrar venta'}
            </LoadingButton>
          </Box>
        </Stack>
      </form>
    </FormProvider>
  );
}

// ----------------------------------------------------------------------

function SaleItems({ products }) {
  const { control, watch } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const items = watch('items');

  const estimatedTotal = items.reduce((acc, item) => {
    const product = products.find((p) => p.id === Number(item.product_id));
    const price = product?.price_retail ?? 0;
    return acc + (Number(item.quantity) || 0) * price - (Number(item.discount) || 0);
  }, 0);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Productos
      </Typography>

      <Stack divider={<Divider flexItem sx={{ borderStyle: 'dashed' }} />} spacing={3}>
        {fields.map((field, index) => (
          <SaleItem key={field.id} index={index} products={products} onRemove={() => remove(index)} />
        ))}
      </Stack>

      <Divider sx={{ my: 3, borderStyle: 'dashed' }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          size="small"
          startIcon={<Iconify icon="mingcute:add-line" />}
          onClick={() => append({ ...defaultItem })}
        >
          Agregar producto
        </Button>

        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Total estimado
          </Typography>
          <Typography variant="h4">${estimatedTotal.toFixed(2)}</Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            El precio final lo calcula el sistema
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ----------------------------------------------------------------------

function SaleItem({ index, products, onRemove }) {
  const { watch } = useFormContext();

  const productId = watch(`items[${index}].product_id`);
  const quantity = watch(`items[${index}].quantity`);
  const discount = watch(`items[${index}].discount`);

  const product = products.find((p) => p.id === Number(productId));
  const priceRetail = product?.price_retail ?? 0;
  const lineTotal = (Number(quantity) || 0) * priceRetail - (Number(discount) || 0);

  return (
    <Box sx={{ gap: 2, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '3fr 1fr 1fr 2fr' },
          alignItems: 'start',
        }}
      >
        <Field.Select name={`items[${index}].product_id`} label="Producto *" size="small">
          {products.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.title}
            </MenuItem>
          ))}
        </Field.Select>

        <Field.Text
          name={`items[${index}].quantity`}
          label="Cantidad"
          type="number"
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <Field.Text
          name={`items[${index}].discount`}
          label="Descuento ($)"
          type="number"
          size="small"
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

        <Field.Text
          name={`items[${index}].description`}
          label="Nota"
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          size="small"
          color="error"
          startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
          onClick={onRemove}
        >
          Eliminar
        </Button>

        {product && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Precio unitario: <strong>${priceRetail}</strong> · Subtotal estimado:{' '}
            <Box component="span" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
              ${lineTotal.toFixed(2)}
            </Box>
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ----------------------------------------------------------------------

function SalePayments() {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: 'payments' });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Pago
      </Typography>

      <Stack divider={<Divider flexItem sx={{ borderStyle: 'dashed' }} />} spacing={3}>
        {fields.map((field, index) => (
          <SalePaymentItem
            key={field.id}
            index={index}
            onRemove={fields.length > 1 ? () => remove(index) : null}
          />
        ))}
      </Stack>

      <Divider sx={{ my: 3, borderStyle: 'dashed' }} />

      <Button
        size="small"
        startIcon={<Iconify icon="mingcute:add-line" />}
        onClick={() => append({ ...defaultPayment })}
      >
        Agregar forma de pago
      </Button>
    </Box>
  );
}

// ----------------------------------------------------------------------

function SalePaymentItem({ index, onRemove }) {
  const { watch } = useFormContext();
  const method = watch(`payments[${index}].method_payment`);
  const showBankFields = method === 'card' || method === 'transfer';

  return (
    <Box sx={{ gap: 2, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          gap: 2,
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: showBankFields ? '1fr 1fr 1fr 1fr' : '1fr 1fr',
          },
          alignItems: 'start',
        }}
      >
        <Field.Select name={`payments[${index}].method_payment`} label="Método de pago" size="small">
          {PAYMENT_METHODS.map((m) => (
            <MenuItem key={m.value} value={m.value}>
              {m.label}
            </MenuItem>
          ))}
        </Field.Select>

        <Field.Text
          name={`payments[${index}].amount`}
          label="Monto"
          type="number"
          size="small"
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

        {showBankFields && (
          <>
            <Field.Text
              name={`payments[${index}].transaction_number`}
              label="N° de referencia"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Field.Text
              name={`payments[${index}].bank`}
              label="Banco"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </>
        )}
      </Box>

      {onRemove && (
        <Box>
          <Button
            size="small"
            color="error"
            startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
            onClick={onRemove}
          >
            Eliminar
          </Button>
        </Box>
      )}
    </Box>
  );
}
