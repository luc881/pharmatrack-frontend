import { mutate } from 'swr';
import { z as zod } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';
import { useRef, useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';

import { handleApiError } from 'src/utils/handle-api-error';

import { endpoints } from 'src/lib/axios';
import { keepInCloudinary, uploadToCloudinary } from 'src/lib/cloudinary';
import {
  createAnimal,
  updateAnimal,
  useAllGenera,
  useAllMorphs,
  updateSpecies,
  useAllSpecies,
  useAnimalGroupTree,
} from 'src/actions/animal';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Field, FormLeaveGuard } from 'src/components/hook-form';

import { useAuthContext } from 'src/auth/hooks';

import { TaxonDialog } from './taxon-dialog';
import { MoveAnimalMenu } from './move-animal-dialog';
import { VarietyPicker, isGeneSpecies } from './variety-picker';
import {
  PURPOSES,
  purposeOf,
  SEX_OPTIONS,
  PURPOSE_HELP,
  PURPOSE_LABELS,
  PURPOSE_COLORS,
  isClosedStatus,
  saleFormatLabel,
  flattenGroupTree,
  SALE_FORMAT_OPTIONS,
} from './utils';

// ----------------------------------------------------------------------

const schema = zod.object({
  species_id: zod
    .union([zod.string(), zod.number()])
    .refine((v) => v !== '' && Number(v) > 0, { message: 'Selecciona una especie' }),
  sex: zod.enum(['male', 'female', 'unknown']),
  birth_date: zod.string().optional(),
  price: zod.number({ coerce: true }).nonnegative('El precio no puede ser negativo'),
  compare_at_price: zod.union([zod.string(), zod.number()]).optional(),
  price_cost: zod.union([zod.string(), zod.number()]).optional(),
  code: zod.string().optional(),
  morphs: zod.array(zod.number()),
  description: zod.string().optional(),
  image: zod.string().optional(),
  status: zod.enum(['available', 'reserved']).optional(),
  purpose: zod.enum(['sale', 'breeder', 'growing']),
  photos: zod.array(zod.string()),
  requires_legal_doc: zod.boolean(),
  legal_doc: zod.string().optional(),
  legal_doc_url: zod.string().optional(),
  // Del ejemplar, solo en venta: se anuncia en el sitio / botón en la venta rápida
  show_public: zod.boolean(),
  quick_sale: zod.boolean(),
  // Unidades idénticas (solo especies en cepa/paquete)
  // 0 = ya no hay (agotado); el backend lo marca como vendido y el sitio dice "Agotado"
  stock: zod.number({ coerce: true }).int('Solo números enteros').min(0, 'No puede ser negativo').optional(),
  // Alta de varios individuales iguales (p. ej. Phyllium en terrario comunal)
  count: zod.number({ coerce: true }).int('Solo números enteros').min(1, 'Mínimo 1').max(50, 'Máximo 50 a la vez'),
});

// ¿Cuántos paquetes en venta? / ¿Cuántos en crianza? / ¿Cuántas cepas de pie de cría?
const PURPOSE_SUFFIX = { sale: 'en venta', breeder: 'de pie de cría', growing: 'en crianza' };

function stockLabel(saleFormat, purpose) {
  if (saleFormat === 'colony') return `¿Cuántas cepas ${PURPOSE_SUFFIX[purpose]}?`;
  if (saleFormat === 'package') {
    return purpose === 'sale' ? '¿Cuántos paquetes en venta?' : `¿Cuántos ${PURPOSE_SUFFIX[purpose]}?`;
  }
  return 'Cantidad disponible';
}

// «+ Género nuevo» etc. a la vista junto a su selector (no un icono escondido)
const NEW_BUTTON_SX = { height: 56, flexShrink: 0 };

// ----------------------------------------------------------------------

export function AnimalCreateEditForm({ currentAnimal }) {
  const navigate = useNavigate();
  // «Nuevo ejemplar» desde la bitácora o la lista manda de dónde vino
  const { state: navState } = useLocation();
  const isEdit = !!currentAnimal;

  const { user } = useAuthContext();

  const { genera, generaMutate } = useAllGenera();
  const { species: allSpecies, speciesMutate } = useAllSpecies();
  const { groupTree } = useAnimalGroupTree();
  const groupsFlat = flattenGroupTree(groupTree);

  // Crear/editar taxonomía sin salir del formulario: {tab, current?}
  const [quickCreate, setQuickCreate] = useState(null);
  const canCreate = (resource) => user?.permissions?.includes(`${resource}.create`);
  const canUpdateSpecies = user?.permissions?.includes('species.update');

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      species_id: '',
      sex: 'unknown',
      birth_date: '',
      price: '',
      compare_at_price: '',
      price_cost: '',
      code: '',
      morphs: [],
      description: '',
      image: '',
      status: 'available',
      purpose: 'sale',
      photos: [],
      requires_legal_doc: false,
      legal_doc: '',
      legal_doc_url: '',
      show_public: true,
      quick_sale: false,
      stock: 1,
      count: 1,
    },
    values: currentAnimal
      ? {
          species_id: currentAnimal.species_id,
          sex: currentAnimal.sex ?? 'unknown',
          birth_date: currentAnimal.birth_date ?? '',
          price: currentAnimal.price ?? '',
          compare_at_price: currentAnimal.compare_at_price ?? '',
          price_cost: currentAnimal.price_cost ?? '',
          code: currentAnimal.code ?? '',
          morphs: (currentAnimal.morphs ?? []).map((m) => m.id),
          description: currentAnimal.description ?? '',
          image: currentAnimal.image ?? '',
          status: currentAnimal.status === 'reserved' ? 'reserved' : 'available',
          purpose: purposeOf(currentAnimal),
          photos: currentAnimal.photos ?? [],
          requires_legal_doc: !!currentAnimal.requires_legal_doc,
          legal_doc: currentAnimal.legal_doc ?? '',
          legal_doc_url: currentAnimal.legal_doc_url ?? '',
          show_public: currentAnimal.show_public ?? true,
          quick_sale: !!currentAnimal.quick_sale,
          stock: currentAnimal.stock ?? 1,
          count: 1,
        }
      : undefined,
  });

  const {
    watch,
    reset,
    setError,
    setValue,
    getValues,
    handleSubmit,
    formState: { isSubmitting, dirtyFields, errors },
  } = methods;

  // Alta desde taxonomía: /animal/new?species_id=12&morph_id=44 llega con la
  // taxonomía ya elegida. Espera a que carguen las especies y corre una sola
  // vez (el ref), para no pisar lo que el usuario cambie después.
  const [searchParams] = useSearchParams();
  const prefilledRef = useRef(false);
  const urlPurpose = searchParams.get('purpose');
  useEffect(() => {
    if (!isEdit && PURPOSES.includes(urlPurpose)) setValue('purpose', urlPurpose);
    // viene de la venta rápida: ya marcado como botón de la venta rápida
    if (!isEdit && searchParams.get('quick_sale') === '1') setValue('quick_sale', true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, urlPurpose]);
  useEffect(() => {
    if (isEdit || prefilledRef.current) return;
    const sp = allSpecies.find((s) => s.id === Number(searchParams.get('species_id')));
    if (!sp) return;
    prefilledRef.current = true;
    setValue('species_id', sp.id, { shouldValidate: true });
    const morphId = Number(searchParams.get('morph_id'));
    if (morphId) setValue('morphs', [morphId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, allSpecies, searchParams]);

  const purpose = watch('purpose');
  const isSale = purpose === 'sale';
  const speciesId = watch('species_id');
  const morphIds = watch('morphs');
  const { morphs: allMorphs, morphsMutate } = useAllMorphs();

  const selectedSpecies = allSpecies.find((s) => s.id === Number(speciesId));

  // Fotos que usa el ejemplar mientras no tenga propias: las de su variedad
  // (la primera que tenga) o las de su especie. Se ven aquí para saber qué
  // saldrá en la tienda y en la venta rápida.
  const inherited = useMemo(() => {
    if (!selectedSpecies) return null;
    const speciesName =
      selectedSpecies.common_name ??
      [selectedSpecies.genus?.name, selectedSpecies.name].filter(Boolean).join(' ');
    const photosOf = (taxon) => (taxon?.photos?.length ? taxon.photos : taxon?.image ? [taxon.image] : []);
    const morph = (morphIds ?? [])
      .map((id) => allMorphs.find((m) => m.id === id))
      .find((m) => photosOf(m).length);
    if (morph) return { from: `${speciesName} · ${morph.name}`, photos: photosOf(morph) };
    return { from: speciesName, photos: photosOf(selectedSpecies) };
  }, [selectedSpecies, allMorphs, morphIds]);

  // Atributos de venta de la especie (formato, tamaño de paquete y escalas de
  // precio). Se editan aquí y al guardar se aplican a la especie (afectan a
  // TODOS sus ejemplares). Estado local sincronizado al cambiar de especie.
  const [saleFormat, setSaleFormat] = useState('individual');
  const [packageSize, setPackageSize] = useState('');
  const [tiers, setTiers] = useState([]);

  useEffect(() => {
    if (!selectedSpecies) {
      setSaleFormat('individual');
      setPackageSize('');
      setTiers([]);
      return;
    }
    setSaleFormat(selectedSpecies.sale_format ?? 'individual');
    setPackageSize(selectedSpecies.package_size ?? '');
    setTiers((selectedSpecies.price_tiers ?? []).map((t) => ({ quantity: t.quantity, price: t.price })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpecies?.id]);

  // Cepas/paquetes: un registro con N unidades idénticas (stock del lote gemelo).
  // Se deriva del formato editable para que el formulario cambie de modo al vuelo.
  const isBulk = !!selectedSpecies && saleFormat !== 'individual';

  // Al CAMBIAR de especie se limpian los morphs (pertenecen a la anterior;
  // el backend rechaza con 400 morphs de otra especie). El ref distingue la
  // primera carga (editar: los values llegan después del primer render y
  // antes borraban los morphs guardados) de un cambio real del usuario.

  // vendido o murió: el estado no se edita aquí (no se puede revivir ni regresar a la venta)
  const isSold = isClosedStatus(currentAnimal?.status);

  const photos = watch('photos');
  const requiresLegalDoc = watch('requires_legal_doc');
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');

  const addPhotoFiles = async (files) => {
    setPhotosLoading(true);
    try {
      const urls = await Promise.all([...files].map((f) => uploadToCloudinary(f)));
      setValue('photos', [...getValues('photos'), ...urls], { shouldDirty: true });
    } catch {
      toast.error('Error al subir las fotos');
    } finally {
      setPhotosLoading(false);
    }
  };

  const removePhoto = (index) =>
    setValue('photos', getValues('photos').filter((_, i) => i !== index), { shouldDirty: true });

  // Varios iguales de una vez: solo al dar de alta individuales
  const count = !isEdit && !isBulk ? Number(watch('count')) || 1 : 1;

  // addAnother: «Guardar y agregar otro» se queda en el formulario con la
  // especie, destino y precio puestos; solo limpia lo de cada ejemplar
  const save = (addAnother) => handleSubmit(async (data) => {
    if (saleFormat === 'package' && !(Number(packageSize) >= 2)) {
      toast.error('Indica cuántos ejemplares trae el paquete (mínimo 2)');
      return;
    }
    // 0 solo tiene sentido al editar (agotar); un alta nueva necesita existencias
    if (!isEdit && isBulk && Number(data.stock) < 1) {
      setError('stock', { message: 'Para dar de alta necesitas al menos 1' });
      return;
    }
    try {
      // El formato/escala son de la especie: se guardan aparte y afectan a todos
      // sus ejemplares. Va primero para que el backend valide bien el stock.
      if (canUpdateSpecies && data.species_id) {
        await updateSpecies(Number(data.species_id), {
          sale_format: saleFormat,
          package_size: saleFormat === 'package' ? Number(packageSize) : null,
          price_tiers:
            saleFormat === 'individual'
              ? null
              : tiers
                  .filter((t) => Number(t.quantity) >= 1 && Number(t.price) > 0)
                  .map((t) => ({ quantity: Number(t.quantity), price: Number(t.price) })),
        });
        await speciesMutate();
      }

      // Especies de stock (cepa/paquete): sin sexo, fecha ni papeles por ejemplar
      const legalDoc = !isBulk && data.requires_legal_doc;
      const payload = {
        species_id: Number(data.species_id),
        sex: isBulk ? 'unknown' : data.sex,
        birth_date: !isBulk && data.birth_date ? data.birth_date : null,
        // sin venta no hay precio: el backend exige el campo, va en 0
        price: isSale ? Number(data.price) : 0,
        compare_at_price:
          isSale && data.compare_at_price !== '' && data.compare_at_price != null
            ? Number(data.compare_at_price)
            : null,
        price_cost: data.price_cost !== '' && data.price_cost != null ? Number(data.price_cost) : 0,
        morph_ids: data.morphs,
        description: data.description || null,
        image: data.image || null,
        // replace-all: siempre se manda la lista completa resultante
        photos: data.photos,
        requires_legal_doc: legalDoc,
        legal_doc: legalDoc ? data.legal_doc || null : null,
        legal_doc_url: legalDoc ? data.legal_doc_url || null : null,
        // solo cuentan en venta (pie de cría y crianza nunca se anuncian)
        ...(isSale ? { show_public: data.show_public, quick_sale: data.quick_sale } : {}),
        // si se omite el código, el backend genera uno "AN-XXXXXXXX" (siempre, con varios)
        ...(data.code && count === 1 ? { code: data.code } : {}),
        ...(count > 1 ? { count } : {}),
        // solo las cepas/paquetes manejan stock; individuales quedan en 1
        // (antes `|| 1` convertía un 0 en 1 y no había forma de agotar a mano).
        // Al editar va solo si se tocó: reenviar un 0 marcaría «Vendido» un registro vacío
        ...(isBulk && (!isEdit || dirtyFields.stock)
          ? { stock: Number.isFinite(Number(data.stock)) ? Number(data.stock) : 1 }
          : {}),
        // "sold" lo asigna la venta y "deceased" la bitácora — nunca se manda desde aquí
        ...(isEdit && !isSold ? { status: data.status } : {}),
      };

      if (isEdit) {
        // el destino se cambia con «Mover a…»; el PUT rechaza `purpose`
        await updateAnimal(currentAnimal.id, payload);
      } else {
        await createAnimal({ ...payload, purpose: data.purpose });
      }

      toast.success(
        isEdit ? 'Animal actualizado' : count > 1 ? `${count} animales registrados` : 'Animal registrado'
      );
      mutate((key) => Array.isArray(key) && key[0] === endpoints.animal.list);
      if (addAnother) {
        reset({
          ...data,
          sex: 'unknown',
          birth_date: '',
          code: '',
          description: '',
          image: '',
          photos: [],
          requires_legal_doc: false,
          legal_doc: '',
          legal_doc_url: '',
          stock: 1,
          count: 1,
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const home =
        data.purpose === 'sale' ? paths.dashboard.animal.root : paths.dashboard.animal.breeding;
      navigate(navState?.from ?? home, {
        state: { expand: Number(data.species_id) },
      });
    } catch (error) {
      if (!handleApiError(error, setError)) {
        toast.error(error.message || 'Error al guardar el animal');
      }
    }
  });
  const onSubmit = save(false);

  return (
    <FormProvider {...methods}>
      <FormLeaveGuard />
      <form onSubmit={onSubmit}>
        <Card sx={{ p: 3, mb: 3 }}>
          {isEdit ? (
            <Box sx={{ gap: 1.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="h6">Destino</Typography>
              <Chip label={PURPOSE_LABELS[purposeOf(currentAnimal)]} color={PURPOSE_COLORS[purposeOf(currentAnimal)]} />
              <MoveAnimalMenu
                animal={currentAnimal}
                species={selectedSpecies ?? currentAnimal.species}
                onMoved={() => mutate(endpoints.animal.details(currentAnimal.id))}
              />
            </Box>
          ) : (
            <>
              <Typography variant="h6" sx={{ mb: 2 }}>
                ¿Para qué es?
              </Typography>
              <Box
                role="radiogroup"
                aria-label="¿Para qué es?"
                sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}
              >
                {PURPOSES.map((p) => (
                  <Box
                    key={p}
                    component="button"
                    type="button"
                    role="radio"
                    aria-checked={purpose === p}
                    onClick={() => setValue('purpose', p, { shouldDirty: true })}
                    sx={(theme) => ({
                      p: 2,
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderRadius: 1.5,
                      font: 'inherit',
                      color: 'text.primary',
                      bgcolor: 'transparent',
                      border: `solid 2px ${purpose === p ? theme.vars.palette.primary.main : theme.vars.palette.divider}`,
                    })}
                  >
                    <Typography variant="subtitle1">{PURPOSE_LABELS[p]}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {PURPOSE_HELP[p]}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Card>

        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Información del animal
          </Typography>

          <Box sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            {/* Especie y variedad en un solo buscador (nombre común, científico o
                de la variedad); las especies de genes marcan varios debajo */}
            <Box
              sx={{ gap: 1, display: 'flex', alignItems: 'flex-start', gridColumn: { sm: 'span 2' } }}
            >
              <VarietyPicker
                sx={{ flex: 1 }}
                value={{ speciesId, morphIds }}
                onChange={(next) => {
                  setValue('species_id', next.species?.id ?? '', {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  setValue('morphs', next.morphIds, { shouldDirty: true });
                }}
                label="Especie y variedad *"
                error={errors.species_id?.message}
                helperText={
                  errors.species_id?.message ??
                  'Busca por nombre común, científico o de la variedad (Glacier, Papaya…).'
                }
              />
              {canCreate('species') && (
                <Button
                  variant="outlined"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                  onClick={() => setQuickCreate({ tab: 'species' })}
                  sx={NEW_BUTTON_SX}
                >
                  Especie nueva
                </Button>
              )}
              {canCreate('morphs') && (
                <Button
                  variant="outlined"
                  disabled={!speciesId}
                  startIcon={<Iconify icon="mingcute:add-line" />}
                  onClick={() => setQuickCreate({ tab: 'morphs' })}
                  sx={NEW_BUTTON_SX}
                >
                  {isGeneSpecies(selectedSpecies) ? 'Gen nuevo' : 'Variedad nueva'}
                </Button>
              )}
            </Box>

            {/* El formato de la especie decide el modo del formulario:
                individual = folio único con sexo/nacimiento/papeles;
                cepa/paquete = solo cantidad de stock. Se edita aquí y aplica a
                toda la especie. */}
            {selectedSpecies && (
              <Box
                sx={{
                  p: 2,
                  gridColumn: { sm: 'span 2' },
                  borderRadius: 1,
                  border: (theme) => `dashed 1px ${theme.vars.palette.divider}`,
                }}
              >
                <Typography variant="subtitle2">Formato de venta de la especie</Typography>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 2 }}>
                  Aplica a todos los ejemplares de {selectedSpecies.name}
                  {selectedSpecies.common_name ? ` (${selectedSpecies.common_name})` : ''}.
                </Typography>

                {canUpdateSpecies ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box
                      sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}
                    >
                      <TextField
                        select
                        label="Formato de venta"
                        value={saleFormat}
                        onChange={(e) => setSaleFormat(e.target.value)}
                      >
                        {SALE_FORMAT_OPTIONS.map((o) => (
                          <MenuItem key={o.value} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </TextField>

                      {saleFormat === 'package' && (
                        <TextField
                          type="number"
                          label="Ejemplares por paquete *"
                          value={packageSize}
                          onChange={(e) => setPackageSize(e.target.value)}
                          // se confundía con la existencia: esto es el tamaño del paquete
                          helperText="Cuántos animales trae cada paquete (p. ej. 6). Para agotarlo usa «Paquetes disponibles» más abajo."
                          slotProps={{ htmlInput: { min: 2 }, inputLabel: { shrink: true } }}
                        />
                      )}
                    </Box>

                    {saleFormat !== 'individual' && isSale && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                          Escalas de precio por cantidad
                        </Typography>
                        <Typography variant="caption" sx={{ mb: 1.5, display: 'block', color: 'text.secondary' }}>
                          Opcional: precios por volumen (p. ej. 6 → $150, 12 → $270). El sitio muestra
                          el selector de cantidad con estos precios.
                        </Typography>
                        {tiers.map((tier, index) => (
                          <Box key={index} sx={{ mb: 1, gap: 1, display: 'flex', alignItems: 'center' }}>
                            <TextField
                              size="small"
                              type="number"
                              label="Cantidad"
                              value={tier.quantity}
                              onChange={(e) =>
                                setTiers((prev) =>
                                  prev.map((t, i) => (i === index ? { ...t, quantity: e.target.value } : t))
                                )
                              }
                              slotProps={{ htmlInput: { min: 1 } }}
                              sx={{ width: 110 }}
                            />
                            <TextField
                              size="small"
                              type="number"
                              label="Precio ($)"
                              value={tier.price}
                              onChange={(e) =>
                                setTiers((prev) =>
                                  prev.map((t, i) => (i === index ? { ...t, price: e.target.value } : t))
                                )
                              }
                              slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                              sx={{ width: 130 }}
                            />
                            <Button
                              size="small"
                              color="error"
                              onClick={() => setTiers((prev) => prev.filter((_, i) => i !== index))}
                            >
                              Quitar
                            </Button>
                          </Box>
                        ))}
                        <Button
                          size="small"
                          onClick={() => setTiers((prev) => [...prev, { quantity: '', price: '' }])}
                        >
                          + Agregar escala
                        </Button>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Alert severity="info" variant="outlined">
                    {isBulk
                      ? `Se vende por ${saleFormatLabel(selectedSpecies)?.toLowerCase()} — solo por cantidad de stock. No tienes permiso para cambiar el formato.`
                      : 'Se vende por ejemplar individual. No tienes permiso para cambiar el formato.'}
                  </Alert>
                )}
              </Box>
            )}

            {!isBulk && (
              <Field.Select name="sex" label="Sexo">
                {SEX_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Field.Select>
            )}

            {!isEdit && !isBulk && (
              <Field.Text
                name="count"
                label="¿Cuántos ejemplares iguales?"
                type="number"
                helperText="Para varios iguales que viven juntos (p. ej. Phyllium): se crea uno por cada uno, cada quien con su código"
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: 1, max: 50 } }}
              />
            )}

            {isBulk && (
              <Field.Text
                name="stock"
                label={stockLabel(saleFormat, purpose)}
                type="number"
                helperText={
                  !isSale
                    ? 'Cuántos tienes en este destino'
                    : isEdit
                      ? 'Se descuentan al vender. Pon 0 si ya no tienes: se marca como agotado en el sitio.'
                      : 'Unidades idénticas de esta cepa/paquete; se descuentan al vender'
                }
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: isEdit ? 0 : 1 } }}
              />
            )}

            {!isBulk && (
              <Field.Text
                name="birth_date"
                label="Fecha de nacimiento"
                type="date"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}

            {isSale && (
              <Box sx={{ gridColumn: { sm: 'span 2' }, display: 'flex', flexDirection: 'column' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={watch('show_public')}
                      onChange={(e) => setValue('show_public', e.target.checked, { shouldDirty: true })}
                    />
                  }
                  label="Mostrar en el sitio"
                />
                <Typography variant="caption" sx={{ ml: 4, mt: -0.5, color: 'text.secondary' }}>
                  Apagado: se vende en mostrador o en la venta rápida sin anunciarse en la tienda.
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={watch('quick_sale')}
                      onChange={(e) => setValue('quick_sale', e.target.checked, { shouldDirty: true })}
                    />
                  }
                  label="También en la venta rápida (botón para convenciones)"
                />
              </Box>
            )}

            {isSale && (
              <>
                <Field.Text
                  name="price"
                  label="Precio de venta *"
                  type="number"
                  helperText={
                    isBulk
                      ? `Precio por ${selectedSpecies?.sale_format === 'package' ? `paquete de ${selectedSpecies.package_size}` : 'cepa'}`
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
                  label="Precio anterior (oferta)"
                  type="number"
                  helperText="Se muestra tachado en la tienda; vacío = sin oferta"
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
              </>
            )}

            <Field.Text
              name="price_cost"
              label="Costo"
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

            {count === 1 && (
              <Field.Text
                name="code"
                label="Código"
                helperText="Si se deja vacío se genera automáticamente"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}

            {currentAnimal?.status === 'deceased' && (
              <Alert severity="error" sx={{ gridColumn: { sm: 'span 2' } }}>
                Murió (baja registrada en la bitácora). Si fue un error, borra esa entrada en la
                bitácora y regresa a la venta.
              </Alert>
            )}

            {isEdit && !isSold && (
              <Field.Select name="status" label="Estado">
                {/* apartar es de la venta; fuera de venta solo está activo */}
                <MenuItem value="available">{isSale ? 'Disponible' : 'Activo'}</MenuItem>
                {isSale && <MenuItem value="reserved">Reservado</MenuItem>}
              </Field.Select>
            )}

            <Field.Text
              name="image"
              label="Imagen (URL)"
              sx={{ gridColumn: { sm: 'span 2' } }}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <Field.Text
              name="description"
              label="Descripción"
              multiline
              rows={3}
              sx={{ gridColumn: { sm: 'span 2' } }}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            {/* Documentación legal (SEMARNAT) — opcional por animal */}
            {!isBulk && (
              <Field.Switch
                name="requires_legal_doc"
                label="Requiere documentación legal (SEMARNAT)"
                sx={{ gridColumn: { sm: 'span 2' } }}
              />
            )}

            {!isBulk && requiresLegalDoc && (
              <>
                <Field.Text
                  name="legal_doc"
                  label="Folio del documento"
                  helperText="Folio/referencia de procedencia legal"
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <Field.Text
                  name="legal_doc_url"
                  label="URL del documento"
                  helperText="Enlace al documento escaneado"
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </>
            )}

            {/* Fotos — replace-all: la lista que se ve es la que se guarda */}
            <Box sx={{ gridColumn: { sm: 'span 2' } }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Fotos
              </Typography>

              {/* Sin fotos propias: las heredadas, en gris */}
              {photos.length === 0 && !watch('image') && inherited && (
                <Box sx={{ mb: 2 }}>
                  {inherited.photos.length > 0 ? (
                    <>
                      <Box sx={{ mb: 1, gap: 1, display: 'flex', flexWrap: 'wrap' }}>
                        {inherited.photos.map((url, index) => (
                          <Box
                            key={url}
                            component="img"
                            src={url}
                            alt={`Foto heredada ${index + 1}`}
                            sx={{ width: 96, height: 96, borderRadius: 1, objectFit: 'cover', opacity: 0.55 }}
                          />
                        ))}
                      </Box>
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                        Heredadas de {inherited.from}
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                      Ni la variedad ni la especie tienen fotos todavía: súbelas en «Especies y morphs»
                      o pon aquí las de este ejemplar.
                    </Typography>
                  )}
                </Box>
              )}

              {photos.length > 0 && (
                <Box sx={{ mb: 2, gap: 1, display: 'flex', flexWrap: 'wrap' }}>
                  {photos.map((url, index) => (
                    <Box key={`${url}-${index}`} sx={{ position: 'relative' }}>
                      <Box
                        component="img"
                        src={url}
                        alt={`Foto ${index + 1}`}
                        sx={{ width: 96, height: 96, borderRadius: 1, objectFit: 'cover' }}
                      />
                      <IconButton
                        size="small"
                        aria-label={`Quitar foto ${index + 1}`}
                        onClick={() => removePhoto(index)}
                        sx={{
                          top: 2,
                          right: 2,
                          position: 'absolute',
                          bgcolor: 'background.paper',
                          '&:hover': { bgcolor: 'background.paper' },
                        }}
                      >
                        <Iconify icon="mingcute:close-line" width={14} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}

              <Box sx={{ gap: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
                <Button
                  component="label"
                  variant="outlined"
                  loading={photosLoading}
                  startIcon={<Iconify icon="solar:camera-add-bold" />}
                >
                  Subir fotos
                  <input
                    hidden
                    multiple
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.length) addPhotoFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </Button>

                <TextField
                  size="small"
                  label="o pega una URL"
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  sx={{ minWidth: 240 }}
                />
                <Button
                  disabled={!photoUrlInput.trim()}
                  loading={photosLoading}
                  onClick={async () => {
                    setPhotosLoading(true);
                    try {
                      const src = await keepInCloudinary(photoUrlInput.trim());
                      setValue('photos', [...getValues('photos'), src], { shouldDirty: true });
                      setPhotoUrlInput('');
                    } catch {
                      toast.error('No se pudo subir ese link');
                    } finally {
                      setPhotosLoading(false);
                    }
                  }}
                >
                  Agregar
                </Button>
              </Box>

              <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
                Fotos propias de este ejemplar (útil cuando cada uno se ve distinto, como una serpiente). Sin fotos
                propias se usan las de su variedad o especie, que se editan en «Especies y morphs».
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 3, gap: 1.5, display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!isEdit && (
              <Button variant="outlined" loading={isSubmitting} onClick={save(true)}>
                Guardar y agregar otro
              </Button>
            )}
            <Button type="submit" variant="contained" loading={isSubmitting}>
              {isEdit ? 'Guardar cambios' : count > 1 ? `Registrar ${count} animales` : 'Registrar animal'}
            </Button>
          </Box>
        </Card>
      </form>

      {/* Crear género/especie/morph al vuelo; lo creado queda seleccionado */}
      {quickCreate && (
        <TaxonDialog
          tab={quickCreate.tab}
          singular={{ genera: 'género', species: 'especie', morphs: 'morph' }[quickCreate.tab]}
          current={quickCreate.current ?? null}
          initial={{
            genus_id: selectedSpecies?.genus?.id ?? selectedSpecies?.genus_id ?? '',
            species_id: speciesId || '',
          }}
          genera={genera}
          allSpecies={allSpecies}
          groupsFlat={groupsFlat}
          onClose={() => setQuickCreate(null)}
          onSaved={async (saved) => {
            if (quickCreate.tab === 'genera') {
              await generaMutate();
            } else if (quickCreate.tab === 'species') {
              await speciesMutate();
              // editar (p. ej. cambiar el formato de venta) conserva la selección
              if (!quickCreate.current) {
                setValue('species_id', saved.id, { shouldValidate: true });
                setValue('morphs', []);
              }
            } else {
              await morphsMutate();
              // con nombre es una sola variedad; los genes se suman
              setValue(
                'morphs',
                isGeneSpecies(selectedSpecies) ? [...getValues('morphs'), saved.id] : [saved.id],
                { shouldDirty: true }
              );
            }
          }}
        />
      )}
    </FormProvider>
  );
}
