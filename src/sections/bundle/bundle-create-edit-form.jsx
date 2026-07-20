import { z as zod } from 'zod';
import { useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';

import { fCurrency } from 'src/utils/format-number';
import { handleApiError } from 'src/utils/handle-api-error';

import { uploadToCloudinary } from 'src/lib/cloudinary';
import { createProductCategory } from 'src/actions/product-category';
import {
  createProduct,
  updateProduct,
  useGetProducts,
  setBundleItems,
  getBundleItems,
  useGetProductCategories,
} from 'src/actions/product';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------
// Un paquete ES un producto (sin stock propio): al venderlo se descuenta
// cada componente — incluidos los gemelos POS de animales, así un kit
// puede llevar un gecko + cueva + sustrato con precio de paquete.
// ----------------------------------------------------------------------

const schema = zod.object({
  title: zod.string().min(1, 'El nombre es obligatorio'),
  sku: zod.string().optional(),
  price_retail: zod.number({ coerce: true }).positive('El precio es obligatorio'),
  compare_at_price: zod.union([zod.string(), zod.number()]).optional(),
  description: zod.string().optional(),
  image: zod.string().optional(),
  show_online: zod.boolean(),
});

const BUNDLES_CATEGORY = 'Paquetes';

export function BundleCreateEditForm({ currentBundle }) {
  const navigate = useNavigate();
  const isEdit = !!currentBundle;

  const { categories, categoriesMutate } = useGetProductCategories();

  // Buscador de componentes (server-side por texto): CUALQUIER producto del
  // catálogo puede ser componente — farmacia, insumos o animales
  const [componentSearch, setComponentSearch] = useState('');
  const { products: componentOptions } = useGetProducts({
    search: componentSearch || undefined,
    pageSize: 50,
    ordering: 'title',
  });
  const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  // groupBy exige opciones agrupadas: ordenar por categoría y luego título
  const sortedOptions = [...componentOptions].sort((a, b) => {
    const catA = categoriesById[a.product_category_id] ?? '';
    const catB = categoriesById[b.product_category_id] ?? '';
    return catA.localeCompare(catB) || a.title.localeCompare(b.title);
  });

  // Componentes elegidos: [{ product, quantity }]
  const [components, setComponents] = useState([]);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    if (!currentBundle) return;
    getBundleItems(currentBundle.id)
      .then((items) =>
        setComponents(
          items.map((item) => ({ product: item.component, quantity: item.quantity }))
        )
      )
      .catch(() => toast.error('No se pudieron cargar los componentes'));
  }, [currentBundle]);

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      sku: '',
      price_retail: '',
      compare_at_price: '',
      description: '',
      image: '',
      show_online: true,
    },
    values: currentBundle
      ? {
          title: currentBundle.title ?? '',
          sku: currentBundle.sku ?? '',
          price_retail: currentBundle.price_retail ?? '',
          compare_at_price: currentBundle.compare_at_price ?? '',
          description: currentBundle.description ?? '',
          image: currentBundle.image ?? '',
          show_online: !!currentBundle.show_online,
        }
      : undefined,
  });

  const {
    watch,
    setError,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const image = watch('image');

  const componentsSum = components.reduce(
    (sum, row) => sum + (row.product?.price_retail ?? 0) * (Number(row.quantity) || 0),
    0
  );

  const addComponent = () =>
    setComponents((prev) => [...prev, { product: null, quantity: 1 }]);

  const updateComponent = (index, patch) =>
    setComponents((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const removeComponent = (index) =>
    setComponents((prev) => prev.filter((_, i) => i !== index));

  const uploadImage = async (file) => {
    setImageLoading(true);
    try {
      const url = await uploadToCloudinary(file);
      setValue('image', url, { shouldDirty: true });
    } catch {
      toast.error('Error al subir la imagen');
    } finally {
      setImageLoading(false);
    }
  };

  const ensureCategory = async () => {
    const existing = categories.find((c) => c.name === BUNDLES_CATEGORY);
    if (existing) return existing.id;
    const created = await createProductCategory({ name: BUNDLES_CATEGORY, is_active: true });
    categoriesMutate();
    return created.id;
  };

  const onSubmit = handleSubmit(async (data) => {
    const validComponents = components.filter((row) => row.product?.id);
    if (!validComponents.length) {
      toast.error('Agrega al menos un componente al paquete');
      return;
    }

    try {
      const payload = {
        title: data.title,
        sku: data.sku || `KIT-${Date.now().toString(36).toUpperCase()}`,
        description: data.description || '',
        price_retail: Number(data.price_retail),
        price_cost: 0,
        compare_at_price:
          data.compare_at_price !== '' && data.compare_at_price != null
            ? Number(data.compare_at_price)
            : null,
        image: data.image || null,
        unit_name: 'pieza',
        is_unit_sale: true,
        // sin stock propio: la disponibilidad se deriva de los componentes
        tracks_batches: false,
        show_online: data.show_online,
        is_active: true,
        product_category_id: await ensureCategory(),
      };

      const product = isEdit
        ? await updateProduct(currentBundle.id, payload)
        : await createProduct(payload);

      await setBundleItems(product.id ?? currentBundle.id, validComponents.map((row) => ({
        component_product_id: row.product.id,
        quantity: Number(row.quantity) || 1,
      })));

      toast.success(isEdit ? 'Paquete actualizado' : 'Paquete creado');
      navigate(paths.dashboard.bundle.root);
    } catch (error) {
      if (!handleApiError(error, setError)) {
        toast.error(error.message || 'Error al guardar el paquete');
      }
    }
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit}>
        <Card sx={{ p: 3 }}>
          <Box sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Field.Text name="title" label="Nombre del paquete *" placeholder="Kit inicio tarántula" />

            <Field.Text
              name="sku"
              label="Código (SKU)"
              helperText="Para escanear en el POS; vacío = se genera automático"
            />

            <Field.Text
              name="price_retail"
              label="Precio del paquete *"
              type="number"
              helperText={
                componentsSum > 0
                  ? `Suma de componentes: ${fCurrency(componentsSum)} — el ahorro es tu descuento de paquete`
                  : ''
              }
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
              name="compare_at_price"
              label="Precio anterior (tachado)"
              type="number"
              helperText="Tip: usa la suma de componentes para mostrar el ahorro"
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
              name="description"
              label="Descripción"
              multiline
              rows={3}
              sx={{ gridColumn: { sm: 'span 2' } }}
            />

            {/* Imagen */}
            <Box sx={{ gridColumn: { sm: 'span 2' }, gap: 1.5, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
              {image && (
                <Box
                  component="img"
                  src={image}
                  alt="Paquete"
                  sx={{ width: 96, height: 96, borderRadius: 1.5, objectFit: 'cover' }}
                />
              )}
              <Button
                component="label"
                variant="outlined"
                loading={imageLoading}
                startIcon={<Iconify icon="solar:camera-add-bold" />}
              >
                {image ? 'Cambiar imagen' : 'Subir imagen'}
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) uploadImage(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
              </Button>
              <Field.Text name="image" label="o pega una URL" size="small" sx={{ minWidth: 260 }} />
            </Box>

            <Field.Switch
              name="show_online"
              label="Mostrar en el sitio público"
              sx={{ gridColumn: { sm: 'span 2' } }}
            />

            {/* ── Componentes ── */}
            <Box sx={{ gridColumn: { sm: 'span 2' } }}>
              <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
                Componentes
              </Typography>
              <Typography variant="caption" sx={{ mb: 2, display: 'block', color: 'text.secondary' }}>
                Puede ser cualquier producto del catálogo — insumos, artículos de farmacia o
                animales (estos últimos por su código o nombre). Al vender el paquete se descuenta
                el stock de cada componente y los animales incluidos pasan a vendidos.
              </Typography>

              {components.map((row, index) => (
                <Box key={index} sx={{ mb: 1.5, gap: 1, display: 'flex', alignItems: 'center' }}>
                  <Autocomplete
                    size="small"
                    sx={{ flexGrow: 1 }}
                    options={sortedOptions}
                    value={row.product}
                    onChange={(_, product) => updateComponent(index, { product })}
                    onInputChange={(_, value, reason) => {
                      if (reason === 'input') setComponentSearch(value);
                    }}
                    getOptionLabel={(option) => {
                      if (!option) return '';
                      // los gemelos de animales ya llevan el código en el título
                      const showSku = option.sku && !option.title.includes(option.sku);
                      return `${option.title}${showSku ? ` (${option.sku})` : ''}`;
                    }}
                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                    filterOptions={(x) => x} // el filtrado es del servidor
                    groupBy={(option) => categoriesById[option.product_category_id] ?? 'Sin categoría'}
                    noOptionsText="Sin resultados — escribe parte del nombre o SKU"
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Cualquier producto del catálogo"
                        placeholder="Escribe para buscar (nombre o SKU)…"
                      />
                    )}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Cant."
                    value={row.quantity}
                    onChange={(e) => updateComponent(index, { quantity: e.target.value })}
                    slotProps={{ htmlInput: { min: 1 } }}
                    sx={{ width: 84 }}
                  />
                  <Box component="span" sx={{ width: 90, typography: 'body2', color: 'text.secondary', textAlign: 'right' }}>
                    {row.product ? fCurrency((row.product.price_retail ?? 0) * (Number(row.quantity) || 0)) : '—'}
                  </Box>
                  <Tooltip title="Quitar">
                    <IconButton size="small" color="error" onClick={() => removeComponent(index)}>
                      <Iconify icon="mingcute:close-line" width={18} />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}

              <Button
                size="small"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={addComponent}
              >
                Agregar componente
              </Button>

              {components.length > 0 && (
                <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
                  Suma de componentes por separado: <strong>{fCurrency(componentsSum)}</strong>
                </Alert>
              )}
            </Box>
          </Box>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" loading={isSubmitting}>
              {isEdit ? 'Guardar cambios' : 'Crear paquete'}
            </Button>
          </Box>
        </Card>
      </form>
    </FormProvider>
  );
}
