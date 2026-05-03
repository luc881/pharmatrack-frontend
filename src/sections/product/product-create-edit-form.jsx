import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useState, useCallback } from 'react';
import { useBoolean } from 'minimal-shared/hooks';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { handleApiError } from 'src/utils/handle-api-error';

import { uploadToCloudinary } from 'src/lib/cloudinary';
import { createProductBrand } from 'src/actions/product-brand';
import { createProductCategory } from 'src/actions/product-category';
import { createProduct, updateProduct, useGetProductBrands, useGetProductCategories } from 'src/actions/product';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { UploadAvatar } from 'src/components/upload';
import { Form, Field, schemaUtils } from 'src/components/hook-form';

import { InlineCreatableSelect } from './inline-creatable-select';

// ----------------------------------------------------------------------

/**
 * Normalización de texto — espeja la lógica del backend (BeforeValidator en Pydantic).
 * Siempre se aplica onBlur para que el usuario vea el resultado antes de guardar.
 */
function normTitle(s) {
  if (!s) return s;
  const clean = s.replace(/\s+/g, ' ').trim();
  // Capitaliza primera letra de cada palabra alfabética; respeta números (400mg → 400mg)
  return clean
    .split(' ')
    .map((w) => (w && /^[a-záéíóúñA-ZÁÉÍÓÚÑ]/.test(w) ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

function normSKU(s) {
  if (!s) return s;
  return s.replace(/\s+/g, ' ').trim().toUpperCase();
}

// ----------------------------------------------------------------------

// Unidad de venta (contenedor o unidad simple)
const UNIT_OPTIONS = [
  'pieza', 'tableta', 'cápsula', 'gragea', 'óvulo', 'supositorio', 'parche',
  'caja', 'blíster', 'sobre', 'tubo', 'ampolleta', 'vial', 'frasco', 'solución',
  'ml', 'L', 'g', 'kg', 'mg',
];

// Unidad base (la pieza individual dentro del empaque)
const BASE_UNIT_OPTIONS = [
  'tableta', 'cápsula', 'gragea', 'óvulo', 'supositorio', 'parche',
  'ampolleta', 'vial', 'sobre', 'ml', 'g', 'mg', 'pieza',
];

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
  base_unit_name: z.string().nullable(),
  units_per_base: z.coerce.number().positive({ error: 'Debe ser mayor a 0' }).nullable(),
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

  const { categories, categoriesLoading, categoriesMutate } = useGetProductCategories();
  const { brands, brandsLoading, brandsMutate } = useGetProductBrands();

  const handleCreateBrand = useCallback(
    async (name) => {
      const created = await createProductBrand({ name });
      brandsMutate();
      toast.success(`Marca "${created.name}" creada`);
      return created;
    },
    [brandsMutate]
  );

  const handleCreateCategory = useCallback(
    async (name) => {
      const created = await createProductCategory({ name, is_active: true });
      categoriesMutate();
      toast.success(`Categoría "${created.name}" creada`);
      return created;
    },
    [categoriesMutate]
  );

  const [isPack, setIsPack] = useState(!!(currentProduct?.base_unit_name));

  const defaultValues = {
    title: '',
    description: '',
    sku: '',
    product_category_id: '',
    brand_id: '',
    unit_name: 'pieza',
    base_unit_name: null,
    units_per_base: null,
    is_unit_sale: false,
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
    values: currentProduct
      ? {
          ...currentProduct,
          brand_id: currentProduct.brand_id ?? '',
          product_category_id: currentProduct.product_category_id ?? '',
          base_unit_name: currentProduct.base_unit_name ?? null,
          units_per_base: currentProduct.units_per_base ?? null,
        }
      : undefined,
  });

  const {
    reset,
    watch,
    setValue,
    setError,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const allowWarranty = watch('allow_warranty');

  const handlePackToggle = (enabled) => {
    setIsPack(enabled);
    if (!enabled) {
      setValue('base_unit_name', null);
      setValue('units_per_base', null);
      setValue('is_unit_sale', false);
    }
  };

  const [imageLoading, setImageLoading] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const handleUpload = useCallback(
    async (source) => {
      setImageLoading(true);
      try {
        const url = await uploadToCloudinary(source);
        setValue('image', url, { shouldValidate: true });
        setUrlInput('');
      } catch {
        toast.error('Error al subir la imagen');
      } finally {
        setImageLoading(false);
      }
    },
    [setValue]
  );

  const handleImageDrop = useCallback(
    (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleUrlSubmit = useCallback(() => {
    if (urlInput.trim()) handleUpload(urlInput.trim());
  }, [urlInput, handleUpload]);

  const onSubmit = handleSubmit(async (data) => {
    // Limpiar campos nulos opcionales
    const payload = {
      ...data,
      brand_id: data.brand_id || null,
      product_category_id: data.product_category_id || null,
      price_cost: data.price_cost || null,
      warranty_days: data.allow_warranty ? data.warranty_days : null,
      base_unit_name: isPack ? data.base_unit_name : null,
      units_per_base: isPack ? data.units_per_base : null,
      is_unit_sale: isPack ? data.is_unit_sale : false,
    };

    try {
      if (currentProduct) {
        await updateProduct(currentProduct.id, payload);
        toast.success('Producto actualizado');
        router.back();
      } else {
        await createProduct(payload);
        toast.success('Producto creado');
        reset();
        router.push(paths.dashboard.product.root);
      }
    } catch (error) {
      if (!handleApiError(error, setError)) {
        toast.error('Error al guardar el producto');
      }
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
          <Field.Text
            name="title"
            label="Nombre del producto"
            onBlur={(e) => setValue('title', normTitle(e.target.value), { shouldValidate: true })}
          />
          <Field.Text name="description" label="Descripción" multiline rows={4} />

          <Stack spacing={1.5} alignItems="center">
            <UploadAvatar
              value={imageUrl}
              loading={imageLoading}
              onDrop={handleImageDrop}
              maxSize={3145728}
            />

            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              O sube desde una URL
            </Typography>

            <TextField
              size="small"
              fullWidth
              disabled={imageLoading}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
              placeholder="https://ejemplo.com/imagen.jpg"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Iconify icon="solar:link-bold" width={18} sx={{ color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button
                        size="small"
                        variant="soft"
                        disabled={!urlInput.trim() || imageLoading}
                        onClick={handleUrlSubmit}
                      >
                        Subir
                      </Button>
                    </InputAdornment>
                  ),
                },
              }}
            />
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
          <Field.Text
            name="sku"
            label="Código de barras / SKU"
            placeholder="Escanea o escribe el código…"
            onBlur={(e) => setValue('sku', normSKU(e.target.value), { shouldValidate: true })}
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

          <Box
            sx={{
              rowGap: 3,
              columnGap: 2,
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' },
            }}
          >
            <InlineCreatableSelect
              name="product_category_id"
              label="Categoría *"
              options={categories}
              onCreate={handleCreateCategory}
              loading={categoriesLoading}
            />

            <InlineCreatableSelect
              name="brand_id"
              label="Marca"
              options={brands}
              onCreate={handleCreateBrand}
              loading={brandsLoading}
            />

            <Field.Autocomplete
              name="unit_name"
              label="Unidad de venta"
              placeholder="pieza, caja, frasco…"
              freeSolo
              options={UNIT_OPTIONS}
              slotProps={{ textField: { slotProps: { inputLabel: { shrink: true } } } }}
            />
          </Box>

          <Divider sx={{ borderStyle: 'dashed' }} />

          {/* Fraccionamiento */}
          <FormControlLabel
            label={
              <Box>
                <Typography variant="subtitle2">Producto fraccionado / empaquetado</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Activa si este producto contiene múltiples unidades (ej. caja de 10 tabletas)
                </Typography>
              </Box>
            }
            control={
              <Switch
                checked={isPack}
                onChange={(e) => handlePackToggle(e.target.checked)}
                sx={{ mr: 1 }}
              />
            }
            sx={{ alignItems: 'flex-start', ml: 0 }}
          />

          {isPack && (
            <Box
              sx={{
                rowGap: 3,
                columnGap: 2,
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(1, 1fr)', md: 'repeat(3, 1fr)' },
              }}
            >
              <Field.Autocomplete
                name="base_unit_name"
                label="Unidad individual *"
                placeholder="tableta, cápsula, ml…"
                freeSolo
                options={BASE_UNIT_OPTIONS}
                slotProps={{
                  textField: {
                    slotProps: { inputLabel: { shrink: true } },
                    helperText: 'Qué es cada pieza dentro del empaque',
                  },
                }}
              />

              <Field.Text
                name="units_per_base"
                label="Piezas por empaque *"
                type="number"
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Ej: 10 tabletas por caja"
              />

              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Field.Switch
                  name="is_unit_sale"
                  label="También se vende por unidad individual"
                />
              </Box>
            </Box>
          )}

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
