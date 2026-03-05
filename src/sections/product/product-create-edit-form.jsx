import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useBoolean } from 'minimal-shared/hooks';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { createProduct, updateProduct, useGetProductBrands, useGetProductCategories } from 'src/actions/product';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field, schemaUtils } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const ProductSchema = z.object({
  title: z.string().min(1, { error: 'El nombre es requerido' }),
  description: z.string(),
  sku: z.string().min(1, { error: 'El SKU es requerido' }),
  product_category_id: schemaUtils.nullableInput(
    z.coerce.number().min(1, { error: 'La categoría es requerida' }),
    { error: 'La categoría es requerida' }
  ),
  brand_id: z.coerce.number().nullable(),
  unit_name: z.string().min(1, { error: 'La unidad es requerida' }),
  is_unit_sale: z.boolean(),
  price_retail: schemaUtils.nullableInput(
    z.coerce.number().min(0, { error: 'El precio de venta es requerido' }),
    { error: 'El precio de venta es requerido' }
  ),
  price_cost: z.coerce.number().nullable(),
  allow_warranty: z.boolean(),
  warranty_days: z.coerce.number().nullable(),
  is_active: z.boolean(),
  image: z.string().nullable(),
});

// ----------------------------------------------------------------------

export function ProductCreateEditForm({ currentProduct }) {
  const router = useRouter();
  const openDetails = useBoolean(true);
  const openProperties = useBoolean(true);
  const openPricing = useBoolean(true);

  const { categories } = useGetProductCategories();
  const { brands } = useGetProductBrands();

  const defaultValues = {
    title: '',
    description: '',
    sku: '',
    product_category_id: null,
    brand_id: null,
    unit_name: 'pieza',
    is_unit_sale: true,
    price_retail: null,
    price_cost: null,
    allow_warranty: false,
    warranty_days: null,
    is_active: true,
    image: null,
  };

  const methods = useForm({
    resolver: zodResolver(ProductSchema),
    defaultValues,
    values: currentProduct,
  });

  const {
    reset,
    watch,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const allowWarranty = watch('allow_warranty');

  const onSubmit = handleSubmit(async (data) => {
    // Limpiar campos nulos opcionales
    const payload = {
      ...data,
      brand_id: data.brand_id || null,
      price_cost: data.price_cost || null,
      warranty_days: data.allow_warranty ? data.warranty_days : null,
    };

    try {
      if (currentProduct) {
        await updateProduct(currentProduct.id, payload);
        toast.success('Producto actualizado');
      } else {
        await createProduct(payload);
        toast.success('Producto creado');
        reset();
      }
      router.push(paths.dashboard.product.root);
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar el producto');
    }
  });

  const renderCollapseButton = (isOpen, onToggle) => (
    <IconButton onClick={onToggle}>
      <Iconify icon={isOpen ? 'eva:arrow-ios-downward-fill' : 'eva:arrow-ios-forward-fill'} />
    </IconButton>
  );

  const imageUrl = watch('image');

  const renderDetails = () => (
    <Card>
      <CardHeader
        title="Información general"
        subheader="Nombre, descripción e imagen"
        action={renderCollapseButton(openDetails.value, openDetails.onToggle)}
        sx={{ mb: 3 }}
      />

      <Collapse in={openDetails.value}>
        <Divider />
        <Stack spacing={3} sx={{ p: 3 }}>
          <Field.Text name="title" label="Nombre del producto" />
          <Field.Text name="description" label="Descripción" multiline rows={4} />

          <Stack spacing={1.5}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar
                src={imageUrl || ''}
                alt="preview"
                variant="rounded"
                sx={{ width: 72, height: 72, bgcolor: 'background.neutral' }}
              >
                <Iconify icon="solar:gallery-bold" width={32} sx={{ color: 'text.disabled' }} />
              </Avatar>

              <Box sx={{ flexGrow: 1 }}>
                <Field.Text
                  name="image"
                  label="URL de imagen"
                  placeholder="https://ejemplo.com/imagen.jpg"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Iconify icon="solar:link-bold" width={18} sx={{ color: 'text.disabled' }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>
            </Box>
          </Stack>
        </Stack>
      </Collapse>
    </Card>
  );

  const renderProperties = () => (
    <Card>
      <CardHeader
        title="Propiedades"
        subheader="SKU, categoría, marca y unidades"
        action={renderCollapseButton(openProperties.value, openProperties.onToggle)}
        sx={{ mb: 3 }}
      />

      <Collapse in={openProperties.value}>
        <Divider />
        <Stack spacing={3} sx={{ p: 3 }}>
          <Box
            sx={{
              rowGap: 3,
              columnGap: 2,
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' },
            }}
          >
            <Field.Text name="sku" label="SKU / Código de barras" />

            <Field.Select
              name="product_category_id"
              label="Categoría"
              slotProps={{ inputLabel: { shrink: true } }}
            >
              <MenuItem value="">Sin categoría</MenuItem>
              {categories.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
            </Field.Select>

            <Field.Select
              name="brand_id"
              label="Marca"
              slotProps={{ inputLabel: { shrink: true } }}
            >
              <MenuItem value="">Sin marca</MenuItem>
              {brands.map((brand) => (
                <MenuItem key={brand.id} value={brand.id}>
                  {brand.name}
                </MenuItem>
              ))}
            </Field.Select>

            <Field.Text name="unit_name" label="Unidad de venta" placeholder="pieza, caja, ml…" />
          </Box>

          <Field.Switch name="is_unit_sale" label="Venta por unidad individual" />

          <Divider sx={{ borderStyle: 'dashed' }} />

          <Field.Switch name="allow_warranty" label="Tiene garantía" />

          {allowWarranty && (
            <Field.Text
              name="warranty_days"
              label="Días de garantía"
              type="number"
              placeholder="0"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          )}
        </Stack>
      </Collapse>
    </Card>
  );

  const renderPricing = () => (
    <Card>
      <CardHeader
        title="Precios"
        subheader="Precio de venta y costo"
        action={renderCollapseButton(openPricing.value, openPricing.onToggle)}
        sx={{ mb: 3 }}
      />

      <Collapse in={openPricing.value}>
        <Divider />
        <Stack spacing={3} sx={{ p: 3 }}>
          <Box
            sx={{
              columnGap: 2,
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' },
            }}
          >
            <Field.Text
              name="price_retail"
              label="Precio de venta"
              placeholder="0.00"
              type="number"
              slotProps={{
                inputLabel: { shrink: true },
                input: {
                  startAdornment: (
                    <InputAdornment position="start" sx={{ mr: 0.75 }}>
                      <Box component="span" sx={{ color: 'text.disabled' }}>
                        $
                      </Box>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Field.Text
              name="price_cost"
              label="Precio de costo"
              placeholder="0.00"
              type="number"
              slotProps={{
                inputLabel: { shrink: true },
                input: {
                  startAdornment: (
                    <InputAdornment position="start" sx={{ mr: 0.75 }}>
                      <Box component="span" sx={{ color: 'text.disabled' }}>
                        $
                      </Box>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
        </Stack>
      </Collapse>
    </Card>
  );

  const renderActions = () => (
    <Box sx={{ gap: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
      <FormControlLabel
        label="Activo"
        control={
          <Switch
            defaultChecked
            slotProps={{ input: { id: 'is-active-switch' } }}
            {...methods.register('is_active')}
          />
        }
        sx={{ pl: 3, flexGrow: 1 }}
      />

      <Button type="submit" variant="contained" size="large" loading={isSubmitting}>
        {currentProduct ? 'Guardar cambios' : 'Crear producto'}
      </Button>
    </Box>
  );

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Stack spacing={{ xs: 3, md: 5 }} sx={{ mx: 'auto', maxWidth: { xs: 720, xl: 880 } }}>
        {renderDetails()}
        {renderProperties()}
        {renderPricing()}
        {renderActions()}
      </Stack>
    </Form>
  );
}
