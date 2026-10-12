import { z as zod } from 'zod';
import { useNavigate } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { createRefundProduct } from 'src/actions/refund-product';

import { toast } from 'src/components/snackbar';
import { Field, FormLeaveGuard } from 'src/components/hook-form';

import { ProductSelect } from '../product/product-select';

// ----------------------------------------------------------------------

const schema = zod.object({
  product_id: zod.union([zod.string(), zod.number()]).refine((v) => v !== '' && v != null, {
    message: 'El producto es requerido',
  }),
  quantity: zod
    .number({ invalid_type_error: 'La cantidad es requerida' })
    .positive('Debe ser mayor a 0'),
  reason: zod.string().optional(),
});

// ----------------------------------------------------------------------

export function RefundProductCreateForm() {
  const navigate = useNavigate();

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      product_id: '',
      quantity: 1,
      reason: '',
    },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      await createRefundProduct({
        product_id: Number(data.product_id),
        quantity: data.quantity,
        reason: data.reason || null,
      });
      toast.success('Devolución registrada');
      navigate(paths.dashboard.refundProduct.root);
    } catch {
      toast.error('Error al registrar la devolución');
    }
  });

  return (
    <FormProvider {...methods}>
      <FormLeaveGuard />
      <form onSubmit={onSubmit}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Datos de la devolución
          </Typography>

          <Box sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <ProductSelect
              name="product_id"
              creatable={false}
              sx={{ gridColumn: { sm: 'span 2' } }}
            />

            <Field.Text
              name="quantity"
              label="Cantidad *"
              type="number"
              slotProps={{ htmlInput: { min: 1 } }}
            />

            <Field.Text
              name="reason"
              label="Motivo"
              multiline
              rows={3}
              sx={{ gridColumn: { sm: 'span 2' } }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" loading={isSubmitting}>
              Registrar devolución
            </Button>
          </Box>
        </Card>
      </form>
    </FormProvider>
  );
}
