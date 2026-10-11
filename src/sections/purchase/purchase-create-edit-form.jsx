import { z as zod } from 'zod';
import { useNavigate } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider, useFieldArray, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';

import { createSupplier, useGetSuppliers } from 'src/actions/supplier';
import {
  createPurchase,
  updatePurchase,
  createPurchaseDetail,
  deletePurchaseDetail,
} from 'src/actions/purchase';

import { toast } from 'src/components/snackbar';
import { Field } from 'src/components/hook-form';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { ProductSelect } from '../product/product-select';
import { InlineCreatableSelect } from '../product/inline-creatable-select';

// ----------------------------------------------------------------------

const todayISO = () => new Date().toLocaleDateString('en-CA');

const defaultItem = {
  product_id: '',
  quantity: 1,
  unit_price: 0,
  lot_code: '',
  expiration_date: '',
};

const baseItemSchema = zod.object({
  product_id: zod
    .union([zod.string(), zod.number()])
    .refine((v) => v !== '' && Number(v) > 0, { message: 'Selecciona un producto' }),
  quantity: zod.number({ coerce: true }).positive('La cantidad debe ser mayor a 0'),
  unit_price: zod.number({ coerce: true }).nonnegative('El precio no puede ser negativo'),
  lot_code: zod.string().optional(),
  expiration_date: zod.string().optional(),
});

const createItemSchema = baseItemSchema.extend({
  expiration_date: zod
    .string()
    .optional()
    .refine((v) => !v || v >= todayISO(), {
      message: 'La fecha de vencimiento debe ser hoy o una fecha futura',
    }),
});

const buildSchema = (isEdit) => zod.object({
  supplier_id: zod
    .union([zod.string(), zod.number()])
    .refine((v) => v !== '' && Number(v) > 0, { message: 'Selecciona un proveedor' }),
  date_emision: zod.string().optional(),
  description: zod.string().optional(),
  items: zod.array(isEdit ? baseItemSchema : createItemSchema).min(1, 'Agrega al menos un producto'),
});

// ----------------------------------------------------------------------

export function PurchaseCreateEditForm({ currentPurchase, currentDetails = [] }) {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { suppliers, suppliersLoading, suppliersMutate } = useGetSuppliers({ pageSize: 500 });

  const handleCreateSupplier = async (name) => {
    const created = await createSupplier({ name, is_active: true });
    suppliersMutate();
    toast.success(`Proveedor "${created.name}" creado`);
    return created;
  };

  const defaultValues = {
    supplier_id: currentPurchase?.supplier_id ?? '',
    date_emision: currentPurchase?.date_emision
      ? currentPurchase.date_emision.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    description: currentPurchase?.description ?? '',
    items:
      currentDetails.length > 0
        ? currentDetails.map((d) => ({
            _detailId: d.id,
            product_id: d.product_id,
            quantity: d.quantity,
            unit_price: d.unit_price,
            lot_code: d.lot_code ?? '',
            expiration_date: d.expiration_date ?? '',
          }))
        : [defaultItem],
  };

  const methods = useForm({ resolver: zodResolver(buildSchema(!!currentPurchase)), defaultValues });

  const { handleSubmit, formState: { isSubmitting } } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      const total = data.items.reduce(
        (acc, item) => acc + Number(item.quantity) * Number(item.unit_price),
        0
      );

      const purchasePayload = {
        supplier_id: Number(data.supplier_id),
        user_id: user.id,
        total: Number(total.toFixed(2)),
        description: data.description || null,
        date_emision: data.date_emision ? `${data.date_emision}T00:00:00` : null,
      };

      let purchaseId;
      if (currentPurchase) {
        await updatePurchase(currentPurchase.id, purchasePayload);
        purchaseId = currentPurchase.id;
        await Promise.all(currentDetails.map((d) => deletePurchaseDetail(d.id)));
      } else {
        const created = await createPurchase(purchasePayload);
        purchaseId = created.id;
      }

      await Promise.all(
        data.items.map((item) =>
          createPurchaseDetail({
            purchase_id: purchaseId,
            product_id: Number(item.product_id),
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            lot_code: item.lot_code || null,
            expiration_date: item.expiration_date || null,
          })
        )
      );

      toast.success(currentPurchase ? 'Compra actualizada' : 'Compra registrada');
      navigate(paths.dashboard.purchase.root);
    } catch {
      toast.error('Error al guardar la compra');
    }
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit}>
        <Stack spacing={3}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Información de la compra
            </Typography>

            <Box
              sx={{
                gap: 2,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '2fr 1fr 1fr' },
              }}
            >
              <InlineCreatableSelect
                name="supplier_id"
                label="Proveedor *"
                newLabel="Proveedor nuevo"
                options={suppliers}
                onCreate={handleCreateSupplier}
                loading={suppliersLoading}
              />

              <Field.Text
                name="date_emision"
                label="Fecha de emisión"
                type="date"
                slotProps={{ inputLabel: { shrink: true } }}
              />

              <Field.Text
                name="description"
                label="Observaciones"
                multiline
                maxRows={3}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
          </Card>

          <Card>
            <PurchaseItems />
          </Card>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button variant="outlined" onClick={() => navigate(paths.dashboard.purchase.root)}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" loading={isSubmitting}>
              {currentPurchase ? 'Guardar cambios' : 'Registrar compra'}
            </Button>
          </Box>
        </Stack>
      </form>
    </FormProvider>
  );
}

// ----------------------------------------------------------------------

function PurchaseItems() {
  const { control, watch } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const items = watch('items');
  const total = items.reduce(
    (acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    0
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Productos
      </Typography>

      <Stack divider={<Divider flexItem sx={{ borderStyle: 'dashed' }} />} spacing={3}>
        {fields.map((field, index) => (
          <PurchaseItem key={field.id} index={index} onRemove={() => remove(index)} />
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
            Total de la compra
          </Typography>
          <Typography variant="h4">${total.toFixed(2)}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ----------------------------------------------------------------------

function PurchaseItem({ index, onRemove }) {
  const { watch } = useFormContext();

  const quantity = watch(`items[${index}].quantity`);
  const unitPrice = watch(`items[${index}].unit_price`);
  const lineTotal = (Number(quantity) || 0) * (Number(unitPrice) || 0);

  return (
    <Box sx={{ gap: 2, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '3fr 1fr 1fr 1fr 1fr' },
          alignItems: 'start',
        }}
      >
        <ProductSelect name={`items.${index}.product_id`} size="small" />

        <Field.Text
          name={`items[${index}].quantity`}
          label="Cantidad"
          type="number"
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <Field.Text
          name={`items[${index}].unit_price`}
          label="Precio unitario"
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
          name={`items[${index}].lot_code`}
          label="Lote"
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <Field.Text
          name={`items[${index}].expiration_date`}
          label="Vencimiento"
          type="date"
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

        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Subtotal:{' '}
          <Box component="span" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
            ${lineTotal.toFixed(2)}
          </Box>
        </Typography>
      </Box>
    </Box>
  );
}
