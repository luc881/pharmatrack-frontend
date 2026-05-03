import { z as zod } from 'zod';
import { useNavigate } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { useForm, Controller, FormProvider, useFieldArray, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';

import axiosInstance, { endpoints } from 'src/lib/axios';
import { createProductBatch } from 'src/actions/product-batch';
import {
  createSale,
  updateSale,
  useGetBranches,
  createSaleDetail,
  deleteSaleDetail,
  createSalePayment,
  deleteSalePayment,
  createSaleBatchUsage,
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

const BANK_OPTIONS = [
  'BBVA', 'Santander', 'Banamex', 'Banorte', 'HSBC', 'Scotiabank',
  'Inbursa', 'Bajío', 'Afirme', 'Bx+', 'Mifel', 'Monexcb',
  'Azteca', 'Spin by OXXO', 'Mercado Pago', 'Clip', 'Otro',
];

const defaultItem = { product_id: '', batch_id: '', quantity: 1, discount: 0, description: '' };

const defaultPayment = { method_payment: 'cash', amount: 0, transaction_number: '', bank: '' };

const itemSchema = zod.object({
  product_id: zod
    .union([zod.string(), zod.number()])
    .refine((v) => v !== '' && Number(v) > 0, { message: 'Selecciona un producto' }),
  batch_id: zod
    .union([zod.string(), zod.number()])
    .optional()
    .nullable(),
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

// Compute the estimated sale total from form items + product catalog
function computeTotal(items, products) {
  return items.reduce((acc, item) => {
    const product = products.find((p) => p.id === Number(item.product_id));
    const price = product?.price_retail ?? 0;
    return acc + (Number(item.quantity) || 0) * price - (Number(item.discount) || 0);
  }, 0);
}

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

  const { handleSubmit, setValue, watch, formState: { isSubmitting } } = methods;

  // Compute total at the top level so both SaleItems (display) and SalePayments (logic) share it
  const items = watch('items');
  const estimatedTotal = computeTotal(items, products);

  // Detect overpayment to block submit
  const payments = watch('payments');
  const paidTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const isOverpaid = estimatedTotal > 0 && paidTotal > estimatedTotal + 0.01;

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

      const createdDetails = await Promise.all(
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

      // Registrar qué lote se usó en cada línea (si se seleccionó uno)
      const batchUsages = data.items
        .map((item, i) => ({
          sale_detail_id: createdDetails[i].id,
          batch_id: item.batch_id ? Number(item.batch_id) : null,
          quantity: Number(item.quantity),
        }))
        .filter((u) => u.batch_id);

      if (batchUsages.length > 0) {
        await Promise.all(batchUsages.map((u) => createSaleBatchUsage(u)));
      }

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
            <SaleItems products={products} estimatedTotal={estimatedTotal} />
          </Card>

          {/* Payment */}
          <Card>
            <SalePayments estimatedTotal={estimatedTotal} />
          </Card>

          {/* Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button variant="outlined" onClick={() => navigate(paths.dashboard.sale.root)}>
              Cancelar
            </Button>
            <LoadingButton
              type="submit"
              variant="contained"
              loading={isSubmitting}
              disabled={isOverpaid}
            >
              {currentSale ? 'Guardar cambios' : 'Registrar venta'}
            </LoadingButton>
          </Box>
        </Stack>
      </form>
    </FormProvider>
  );
}

// ----------------------------------------------------------------------

function SaleItems({ products, estimatedTotal }) {
  const { control, setValue, getValues } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanFlash, setScanFlash] = useState(null);
  const [lastScanned, setLastScanned] = useState(null);
  const barcodeRef = useRef(null);

  // Auto-foco al montar el formulario
  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  // F2 — regresar al campo de escaneo desde cualquier lugar
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleBarcodeScan = useCallback(
    (value) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      const found = products.find(
        (p) => p.sku && p.sku.toLowerCase() === trimmed.toLowerCase()
      );

      setBarcodeInput('');

      if (found) {
        const currentItems = getValues('items');
        const existingIndex = currentItems.findIndex(
          (item) => Number(item.product_id) === found.id
        );

        if (existingIndex >= 0) {
          const currentQty = Number(currentItems[existingIndex].quantity) || 1;
          setValue(`items[${existingIndex}].quantity`, currentQty + 1);
        } else {
          append({ ...defaultItem, product_id: found.id });
        }

        setScanFlash('success');
        setLastScanned(found.title);
        setTimeout(() => setScanFlash(null), 500);
        setTimeout(() => setLastScanned(null), 2000);
      } else {
        setScanFlash('error');
        setTimeout(() => setScanFlash(null), 500);
        toast.error(`Producto no encontrado: "${trimmed}"`);
      }

      setTimeout(() => barcodeRef.current?.focus(), 50);
    },
    [products, append, getValues, setValue]
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6">Productos</Typography>
      </Box>

      {/* Barcode scanner input */}
      <TextField
        inputRef={barcodeRef}
        size="small"
        fullWidth
        value={barcodeInput}
        onChange={(e) => setBarcodeInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleBarcodeScan(barcodeInput);
          }
        }}
        placeholder="Escanear código de barras o escribir SKU y presionar Enter…"
        helperText={
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip label="F2" size="small" variant="soft" sx={{ height: 16, fontSize: 10, px: 0.5 }} />
            para regresar aquí desde cualquier campo
          </Box>
        }
        sx={{
          mb: lastScanned ? 1 : 3,
          '& .MuiOutlinedInput-root fieldset': {
            transition: 'border-color 0.3s ease, border-width 0.3s ease',
            ...(scanFlash === 'success' && { borderColor: 'success.main', borderWidth: 2 }),
            ...(scanFlash === 'error' && { borderColor: 'error.main', borderWidth: 2 }),
          },
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="solar:barcode-bold" width={20} sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          },
        }}
      />

      {lastScanned && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Iconify icon="solar:check-circle-bold" width={15} sx={{ color: 'success.main' }} />
          <Typography variant="caption" sx={{ color: 'success.main' }}>
            Agregado: {lastScanned}
          </Typography>
        </Box>
      )}

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
            Total
          </Typography>
          <Typography variant="h4">${estimatedTotal.toFixed(2)}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ----------------------------------------------------------------------

// Label shown in the batch Autocomplete for a given batch
function batchLabel(b) {
  const parts = [];
  if (b.lot_code) parts.push(b.lot_code);
  parts.push(b.expiration_date ? `Vence: ${b.expiration_date}` : `Lote #${b.id}`);
  parts.push(`Stock: ${b.quantity}`);
  return parts.join(' — ');
}

const NULL_BATCH = { id: '', label: 'Sin lote' };

function SaleItem({ index, products, onRemove }) {
  const { watch, setValue, control } = useFormContext();
  const [batches, setBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [openAddBatch, setOpenAddBatch] = useState(false);

  const productId = watch(`items[${index}].product_id`);
  const batchId = watch(`items[${index}].batch_id`);
  const quantity = watch(`items[${index}].quantity`);
  const discount = watch(`items[${index}].discount`);

  const product = products.find((p) => p.id === Number(productId));
  const priceRetail = product?.price_retail ?? 0;
  const lineTotal = (Number(quantity) || 0) * priceRetail - (Number(discount) || 0);

  const selectedBatch = batches.find((b) => b.id === Number(batchId));
  const stockWarning = selectedBatch && Number(quantity) > Number(selectedBatch.quantity);

  const loadBatches = useCallback(async (pid) => {
    if (!pid) {
      setBatches([]);
      setValue(`items[${index}].batch_id`, '');
      return;
    }
    setBatchesLoading(true);
    try {
      const res = await axiosInstance.get(endpoints.productBatch.list, {
        params: { product_id: pid, page: 1, page_size: 50 },
      });
      const available = (res.data?.data ?? [])
        .filter((b) => Number(b.quantity) > 0)
        .sort((a, b) => new Date(a.expiration_date) - new Date(b.expiration_date));
      setBatches(available);
      if (available.length > 0) {
        setValue(`items[${index}].batch_id`, available[0].id);
      } else {
        setValue(`items[${index}].batch_id`, '');
      }
    } catch {
      setBatches([]);
    } finally {
      setBatchesLoading(false);
    }
  }, [index, setValue]);

  useEffect(() => {
    loadBatches(productId ? Number(productId) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const handleBatchCreated = useCallback(
    (newBatch) => {
      setBatches((prev) =>
        [...prev, newBatch].sort((a, b) => new Date(a.expiration_date) - new Date(b.expiration_date))
      );
      setValue(`items[${index}].batch_id`, newBatch.id);
      setOpenAddBatch(false);
    },
    [index, setValue]
  );

  const batchOptions = [NULL_BATCH, ...batches.map((b) => ({ id: b.id, label: batchLabel(b) }))];
  const selectedBatchOption =
    batchOptions.find((o) => o.id === (batchId === '' ? '' : Number(batchId))) ?? NULL_BATCH;

  return (
    <Box sx={{ gap: 2, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '2fr 2fr 1fr 1fr' },
          alignItems: 'start',
        }}
      >
        <Controller
          name={`items[${index}].product_id`}
          control={control}
          render={({ field: { value }, fieldState: { error } }) => (
            <Autocomplete
              size="small"
              options={products}
              getOptionLabel={(opt) => (typeof opt === 'object' ? opt.title : products.find((p) => p.id === Number(opt))?.title ?? '')}
              isOptionEqualToValue={(opt, val) => opt.id === (typeof val === 'object' ? val?.id : Number(val))}
              value={products.find((p) => p.id === Number(value)) ?? null}
              onChange={(_, newValue) => setValue(`items[${index}].product_id`, newValue?.id ?? '', { shouldValidate: true })}
              noOptionsText="Sin resultados"
              renderInput={(params) => (
                <TextField {...params} label="Producto *" error={!!error} helperText={error?.message} />
              )}
            />
          )}
        />

        <Box>
          <Controller
            name={`items[${index}].batch_id`}
            control={control}
            render={({ fieldState: { error } }) => (
              <Autocomplete
                size="small"
                options={batchOptions}
                value={selectedBatchOption}
                getOptionLabel={(o) => o.label ?? ''}
                isOptionEqualToValue={(o, v) => o.id === v?.id}
                disabled={!productId || batchesLoading}
                onChange={(_, newVal) =>
                  setValue(`items[${index}].batch_id`, newVal?.id ?? '', { shouldValidate: true })
                }
                noOptionsText="Sin lotes disponibles"
                renderInput={(params) => (
                  <TextField {...params} label="Lote" error={!!error} helperText={error?.message} />
                )}
              />
            )}
          />

          {productId && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
              <Button
                size="small"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={() => setOpenAddBatch(true)}
              >
                {batches.length === 0 ? 'Crear lote' : 'Agregar lote'}
              </Button>
            </Box>
          )}

          {openAddBatch && (
            <AddBatchDialog
              open={openAddBatch}
              onClose={() => setOpenAddBatch(false)}
              productId={Number(productId)}
              existingBatches={batches}
              onCreated={handleBatchCreated}
            />
          )}
        </Box>

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
      </Box>

      <Box
        sx={{
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '3fr 1fr' },
          alignItems: 'start',
        }}
      >
        <Field.Text
          name={`items[${index}].description`}
          label="Nota"
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
          <Button
            size="small"
            color="error"
            startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
            onClick={onRemove}
          >
            Eliminar
          </Button>
        </Box>
      </Box>

      {product && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          {stockWarning ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Iconify icon="solar:danger-triangle-bold" width={15} sx={{ color: 'warning.main' }} />
              <Typography variant="caption" sx={{ color: 'warning.main' }}>
                Stock disponible en este lote: {selectedBatch.quantity} unidades
              </Typography>
            </Box>
          ) : (
            <Box />
          )}
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Precio unitario: <strong>${priceRetail}</strong> · Subtotal:{' '}
            <Box component="span" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
              ${lineTotal.toFixed(2)}
            </Box>
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ----------------------------------------------------------------------

function SalePayments({ estimatedTotal }) {
  const { control, watch, setValue, getValues } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: 'payments' });

  const payments = watch('payments');
  const selectedMethods = payments.map((p) => p.method_payment);
  const paidTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = Number((estimatedTotal - paidTotal).toFixed(2));
  const isOverpaid = remaining < -0.01;

  // Auto-fill the single payment when the sale total changes
  useEffect(() => {
    if (estimatedTotal <= 0) return;
    const currentPayments = getValues('payments');
    if (currentPayments.length === 1) {
      setValue('payments[0].amount', Number(estimatedTotal.toFixed(2)), { shouldValidate: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimatedTotal]);

  // When a payment amount is edited: auto-adjust the "other" payment so the sum stays at total.
  // Rule: if editing payment[i], adjust the last payment that isn't payment[i].
  const handleAmountChange = useCallback((changedIndex, rawValue) => {
    const value = Math.max(0, Number(rawValue) || 0);
    setValue(`payments[${changedIndex}].amount`, value, { shouldValidate: true });

    const currentPayments = getValues('payments');
    if (currentPayments.length < 2 || estimatedTotal <= 0) return;

    const lastIdx = currentPayments.length - 1;
    const adjustIdx = changedIndex !== lastIdx ? lastIdx : lastIdx - 1;

    // Sum everything except the payment being adjusted
    const sumFixed = currentPayments.reduce((sum, p, i) => {
      if (i === adjustIdx) return sum;
      return sum + (i === changedIndex ? value : Number(p.amount) || 0);
    }, 0);

    setValue(
      `payments[${adjustIdx}].amount`,
      Math.max(0, Number((estimatedTotal - sumFixed).toFixed(2))),
      { shouldValidate: true }
    );
  }, [estimatedTotal, getValues, setValue]);

  // When adding a new payment: pre-fill with what's still owed, pick a method not yet used
  const handleAppend = useCallback(() => {
    const nextMethod = PAYMENT_METHODS.find((m) => !selectedMethods.includes(m.value))?.value ?? 'cash';
    const prefillAmount = Math.max(0, Number(remaining.toFixed(2)));
    append({ ...defaultPayment, method_payment: nextMethod, amount: prefillAmount });
  }, [append, remaining, selectedMethods]);

  // All 3 methods already selected → hide the add button
  const canAddPayment = selectedMethods.length < PAYMENT_METHODS.length;

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
            usedMethods={selectedMethods}
            onAmountChange={handleAmountChange}
            onRemove={fields.length > 1 ? () => remove(index) : null}
          />
        ))}
      </Stack>

      <Divider sx={{ my: 3, borderStyle: 'dashed' }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        {canAddPayment ? (
          <Button
            size="small"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={handleAppend}
          >
            Agregar forma de pago
          </Button>
        ) : (
          <Box />
        )}

        {/* Payment summary */}
        <Box sx={{ textAlign: 'right' }}>
          {payments.length > 1 && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.25 }}>
              Pagado:{' '}
              <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                ${paidTotal.toFixed(2)}
              </Box>
            </Typography>
          )}
          {isOverpaid ? (
            <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
              Excede el total por ${Math.abs(remaining).toFixed(2)}
            </Typography>
          ) : (
            remaining > 0.01 && payments.length > 1 && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Pendiente: ${remaining.toFixed(2)}
              </Typography>
            )
          )}
        </Box>
      </Box>
    </Box>
  );
}

// ----------------------------------------------------------------------

function SalePaymentItem({ index, onRemove, usedMethods, onAmountChange }) {
  const { watch, control } = useFormContext();
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
        {/* Method — disable already-selected methods in other rows */}
        <Field.Select name={`payments[${index}].method_payment`} label="Método de pago" size="small">
          {PAYMENT_METHODS.map((m) => (
            <MenuItem
              key={m.value}
              value={m.value}
              disabled={m.value !== method && usedMethods.includes(m.value)}
            >
              {m.label}
            </MenuItem>
          ))}
        </Field.Select>

        {/* Amount — custom onChange feeds the auto-adjust logic */}
        <Controller
          name={`payments[${index}].amount`}
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              label="Monto"
              type="number"
              size="small"
              value={field.value}
              onChange={(e) => onAmountChange(index, e.target.value)}
              onBlur={field.onBlur}
              error={!!error}
              helperText={error?.message}
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
          )}
        />

        {showBankFields && (
          <>
            <Field.Text
              name={`payments[${index}].transaction_number`}
              label="N° de referencia"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Field.Select name={`payments[${index}].bank`} label="Banco" size="small">
              <MenuItem value="">Sin especificar</MenuItem>
              {BANK_OPTIONS.map((b) => (
                <MenuItem key={b} value={b}>{b}</MenuItem>
              ))}
            </Field.Select>
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

// ----------------------------------------------------------------------

function normalize(s) {
  return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function lastDayISO(year, month) {
  const d = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTH_ITEMS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

function ScrollColumn({ items, value, onChange, width }) {
  const ITEM_H = 48;
  const ref = useRef(null);
  const timerRef = useRef(null);
  const currentIndex = items.findIndex((item) => item.value === value);

  useLayoutEffect(() => {
    if (ref.current && currentIndex >= 0) {
      ref.current.scrollTop = currentIndex * ITEM_H;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snapToNearest = useCallback(() => {
    if (!ref.current) return;
    const idx = Math.round(ref.current.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    ref.current.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' });
    onChange(items[clamped].value);
  }, [items, onChange]);

  const handleScroll = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(snapToNearest, 120);
  };

  return (
    <Box sx={{ position: 'relative', width, height: ITEM_H * 5, overflow: 'hidden', userSelect: 'none' }}>
      <Box
        sx={{
          position: 'absolute', top: ITEM_H * 2, left: 4, right: 4, height: ITEM_H,
          bgcolor: 'action.selected', borderRadius: 1, pointerEvents: 'none', zIndex: 0,
        }}
      />
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H * 2, background: (theme) => `linear-gradient(to bottom, ${theme.palette.background.paper} 10%, transparent)`, pointerEvents: 'none', zIndex: 2 }} />
      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H * 2, background: (theme) => `linear-gradient(to top, ${theme.palette.background.paper} 10%, transparent)`, pointerEvents: 'none', zIndex: 2 }} />
      <Box
        ref={ref}
        onScroll={handleScroll}
        sx={{ position: 'absolute', inset: 0, overflowY: 'scroll', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, zIndex: 1 }}
      >
        <Box sx={{ height: ITEM_H * 2 }} />
        {items.map((item) => (
          <Box
            key={item.value}
            onClick={() => {
              const idx = items.findIndex((i) => i.value === item.value);
              ref.current?.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' });
              onChange(item.value);
            }}
            sx={{
              height: ITEM_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', typography: 'body2',
              fontWeight: item.value === value ? 700 : 400,
              color: item.value === value ? 'text.primary' : 'text.secondary',
              transition: 'font-weight 0.15s, color 0.15s',
            }}
          >
            {item.label}
          </Box>
        ))}
        <Box sx={{ height: ITEM_H * 2 }} />
      </Box>
    </Box>
  );
}

function MonthYearPicker({ month, year, onMonthChange, onYearChange }) {
  const currentYear = new Date().getFullYear();
  const yearItems = Array.from({ length: 8 }, (_, i) => ({
    value: currentYear + i,
    label: String(currentYear + i),
  }));

  return (
    <Box sx={{ display: 'flex', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', bgcolor: 'background.paper' }}>
      <ScrollColumn items={MONTH_ITEMS} value={month} onChange={onMonthChange} width={130} />
      <Divider orientation="vertical" flexItem />
      <ScrollColumn items={yearItems} value={year} onChange={onYearChange} width={90} />
    </Box>
  );
}

// ----------------------------------------------------------------------

function AddBatchDialog({ open, onClose, productId, existingBatches, onCreated }) {
  const _now = new Date();
  const _defaultMonth = _now.getMonth() + 2 > 12 ? 1 : _now.getMonth() + 2;
  const _defaultYear = _now.getMonth() + 2 > 12 ? _now.getFullYear() + 1 : _now.getFullYear();

  const [lotCode, setLotCode] = useState('');
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expMonth, setExpMonth] = useState(_defaultMonth);
  const [expYear, setExpYear] = useState(_defaultYear);
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [creating, setCreating] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [duplicateError, setDuplicateError] = useState('');
  const [similarBatches, setSimilarBatches] = useState([]);
  const [pendingCreate, setPendingCreate] = useState(false);

  const todayISO = _now.toLocaleDateString('en-CA');

  const resetWarnings = () => {
    setDuplicateError('');
    setSimilarBatches([]);
    setPendingCreate(false);
  };

  const findSimilar = (code) => {
    const norm = normalize(code);
    if (norm.length < 2) return [];
    return existingBatches.filter((b) => {
      if (!b.lot_code) return false;
      const bNorm = normalize(b.lot_code);
      if (bNorm === norm) return false;
      return bNorm.includes(norm) || norm.includes(bNorm);
    });
  };

  const doCreate = async () => {
    setCreating(true);
    try {
      const created = await createProductBatch({
        product_id: productId,
        lot_code: lotCode.trim() || null,
        expiration_date: hasExpiration ? lastDayISO(expYear, expMonth) : null,
        quantity: Number(quantity),
        purchase_price: purchasePrice ? Number(purchasePrice) : null,
      });
      toast.success('Lote creado');
      onCreated(created);
    } catch {
      toast.error('Error al crear el lote');
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = async () => {
    const errs = {};
    if (!quantity || Number(quantity) <= 0) errs.quantity = 'La cantidad debe ser mayor a 0';
    if (hasExpiration && lastDayISO(expYear, expMonth) < todayISO) {
      errs.expirationDate = 'La fecha de caducidad debe ser igual o posterior al mes actual';
    }
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }

    if (lotCode.trim()) {
      const norm = normalize(lotCode);
      const exact = existingBatches.find((b) => b.lot_code && normalize(b.lot_code) === norm);
      if (exact) { setDuplicateError(`Ya existe el lote "${exact.lot_code}" para este producto`); return; }
      const similar = findSimilar(lotCode);
      if (similar.length > 0) { setSimilarBatches(similar); setPendingCreate(true); return; }
    }

    await doCreate();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Agregar lote</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Código de lote"
            size="small"
            fullWidth
            value={lotCode}
            onChange={(e) => { setLotCode(e.target.value); resetWarnings(); }}
            error={!!duplicateError}
            helperText={duplicateError || 'Opcional'}
          />

          {similarBatches.length > 0 && (
            <Alert severity="warning" icon={<Iconify icon="solar:danger-triangle-bold" width={20} />}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Hay lotes con código similar:{' '}
                <Box component="span" sx={{ fontWeight: 600 }}>
                  {similarBatches.map((b) => b.lot_code).join(', ')}
                </Box>
                . ¿Es un lote nuevo?
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <LoadingButton size="small" variant="contained" color="warning" loading={creating} onClick={doCreate}>
                  Sí, crear &ldquo;{lotCode.trim()}&rdquo;
                </LoadingButton>
                <Button size="small" variant="outlined" color="inherit" onClick={resetWarnings}>
                  Cancelar
                </Button>
              </Box>
            </Alert>
          )}

          <Box>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={hasExpiration}
                  onChange={(e) => {
                    setHasExpiration(e.target.checked);
                    setFieldErrors((p) => ({ ...p, expirationDate: '' }));
                  }}
                />
              }
              label="Tiene fecha de caducidad"
            />

            {hasExpiration && (
              <Box sx={{ mt: 1 }}>
                <MonthYearPicker
                  month={expMonth}
                  year={expYear}
                  onMonthChange={setExpMonth}
                  onYearChange={setExpYear}
                />
                {fieldErrors.expirationDate && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                    {fieldErrors.expirationDate}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5, display: 'block' }}>
                  Se guardará como el último día del mes ({lastDayISO(expYear, expMonth)})
                </Typography>
              </Box>
            )}
          </Box>

          <TextField
            label="Cantidad *"
            type="number"
            size="small"
            fullWidth
            value={quantity}
            onChange={(e) => { setQuantity(e.target.value); setFieldErrors((p) => ({ ...p, quantity: '' })); }}
            error={!!fieldErrors.quantity}
            helperText={fieldErrors.quantity}
          />

          <TextField
            label="Precio de costo"
            type="number"
            size="small"
            fullWidth
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            helperText="Opcional"
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
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={creating}>Cancelar</Button>
        <LoadingButton variant="contained" loading={creating} disabled={pendingCreate} onClick={handleSubmit}>
          Crear lote
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
