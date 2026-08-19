import { usePopover } from 'minimal-shared/hooks';
import { useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { DashboardContent } from 'src/layouts/dashboard';
import {
  updateMorph,
  deleteMorph,
  deleteAnimal,
  useAllGenera,
  useAllMorphs,
  useGetAnimals,
  useAllSpecies,
  deleteSpecies,
  useAnimalGroupTree,
} from 'src/actions/animal';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

import { TaxonDialog } from '../taxon-dialog';
import { AnimalRow } from './animal-list-view';
import { saleFormatLabel, flattenGroupTree } from '../utils';
import {
  STOCK,
  HUSBANDRY,
  ManageDialog,
  stockStateOf,
  availableUnits,
  DEFAULT_LOW_STOCK,
} from './cultivos-view';

// ----------------------------------------------------------------------
// Ficha de especie: hub que unifica clasificación, ficha de cuidados (pública),
// cultivo (privado) y los ejemplares (inventario) de una especie.
// ----------------------------------------------------------------------

export function SpeciesDetailView({ species, loading, error, onMutate }) {
  const navigate = useNavigate();
  // De dónde vino el usuario (Taxonomía con su pestaña y filtro, Cultivos, …):
  // la flecha "atrás" lo devuelve ahí en vez de a la lista de animales.
  const { state, key } = useLocation();
  const backHref = state?.from ?? paths.dashboard.animal.root;
  // Si hay historial dentro de la app, la flecha se comporta igual que el botón
  // "atrás" del navegador (vuelve al estado exacto y no apila otra entrada).
  // key === 'default' = se entró directo por URL: ahí queda el href de respaldo.
  const backOnClick =
    key !== 'default'
      ? (event) => {
          event.preventDefault();
          navigate(-1);
        }
      : undefined;

  const { user } = useAuthContext();
  const has = (perm) => user?.permissions?.includes(perm);
  const canUpdateSpecies = has('species.update');
  const canUpdateAnimals = has('animals.update');
  const canDeleteAnimals = has('animals.delete');
  const canCreateAnimals = has('animals.create');

  const { animals, animalsMutate } = useGetAnimals({
    page: 1,
    pageSize: 500,
    speciesId: species?.id || undefined,
  });

  // Morphs de esta especie: la ficha es el hub, así no hay que ir a Taxonomía
  const { morphs, morphsMutate } = useAllMorphs(species?.id);

  // Datos para el diálogo de ficha de cuidados (reusa TaxonDialog)
  const { genera } = useAllGenera();
  const { species: allSpecies } = useAllSpecies();
  const { groupTree } = useAnimalGroupTree();

  const [dialog, setDialog] = useState(null); // { tab, current, initial } — TaxonDialog
  const [manage, setManage] = useState(null); // { row, kind } — cultivo de especie o morph
  const [toDelete, setToDelete] = useState(null); // { kind, id, name }

  // Unidades disponibles por morph: un ejemplar puede tener varios morphs y su
  // stock cuenta para cada uno (mismo criterio que la vista de Taxonomía).
  const unitsByMorph = useMemo(() => {
    const map = {};
    animals.forEach((a) => {
      if (a.status !== 'available') return;
      (a.morphs ?? []).forEach((m) => {
        map[m.id] = (map[m.id] ?? 0) + (a.stock ?? 1);
      });
    });
    return map;
  }, [animals]);

  const handleConfirmDelete = useCallback(async () => {
    const { kind, id } = toDelete;
    try {
      if (kind === 'animal') {
        await deleteAnimal(id);
        await animalsMutate();
        toast.success('Ejemplar eliminado');
      } else if (kind === 'morph') {
        await deleteMorph(id);
        await morphsMutate();
        toast.success('Morph eliminado');
      } else {
        await deleteSpecies(id);
        toast.success('Especie eliminada');
        navigate(paths.dashboard.animal.taxonomy);
      }
    } catch (err) {
      // el backend rechaza con detalle si tiene dependencias
      toast.error(err.message || 'Error al eliminar');
    } finally {
      setToDelete(null);
    }
  }, [toDelete, animalsMutate, morphsMutate, navigate]);

  if (loading) {
    return (
      <DashboardContent sx={{ pt: 5 }}>
        <Typography>Cargando…</Typography>
      </DashboardContent>
    );
  }

  if (error || !species) {
    return (
      <DashboardContent sx={{ pt: 5 }}>
        <EmptyContent
          filled
          title="Especie no encontrada"
          action={
            <Button
              component={RouterLink}
              href={paths.dashboard.animal.root}
              startIcon={<Iconify width={16} icon="eva:arrow-ios-back-fill" />}
              sx={{ mt: 3 }}
            >
              Volver a animales
            </Button>
          }
          sx={{ py: 10, height: 'auto', flexGrow: 'unset' }}
        />
      </DashboardContent>
    );
  }

  const scientific = [species.genus?.name, species.name].filter(Boolean).join(' ');
  const isBulk = species.sale_format && species.sale_format !== 'individual';
  const format = saleFormatLabel(species);
  const photo = animals.find((a) => a.image || a.photos?.[0]);

  const units = availableUnits(animals);
  const threshold = species.low_stock_threshold ?? DEFAULT_LOW_STOCK;
  const stock = STOCK[stockStateOf(units, threshold)];
  const husbandry = HUSBANDRY[species.husbandry_status ?? 'active'] ?? HUSBANDRY.active;

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading={species.common_name ?? scientific}
        backHref={backHref}
        backOnClick={backOnClick}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Animales', href: paths.dashboard.animal.root },
          { name: species.common_name ?? scientific },
        ]}
        action={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {canCreateAnimals && (
              <Button
                component={RouterLink}
                href={`${paths.dashboard.animal.new}?species_id=${species.id}`}
                variant="outlined"
                startIcon={<Iconify icon="solar:cart-plus-bold" />}
              >
                Poner a la venta
              </Button>
            )}
            {canUpdateSpecies && (
              <Button
                variant="contained"
                startIcon={<Iconify icon="solar:pen-bold" />}
                onClick={() => setDialog({ tab: 'species', current: species })}
              >
                Editar ficha
              </Button>
            )}
            {has('species.delete') && (
              <MoreMenu
                items={[
                  {
                    label: 'Eliminar especie',
                    icon: 'solar:trash-bin-trash-bold',
                    color: 'error.main',
                    onClick: () =>
                      setToDelete({
                        kind: 'species',
                        id: species.id,
                        name: species.common_name ?? scientific,
                      }),
                  },
                ]}
              />
            )}
          </Stack>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Grid container spacing={3}>
        {/* Izquierda — imagen + nombre + descripción pública */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Avatar
                  src={photo?.image || photo?.photos?.[0] || ''}
                  alt={scientific}
                  variant="rounded"
                  sx={{
                    width: '100%',
                    maxWidth: 400,
                    aspectRatio: '1 / 1',
                    height: 'auto',
                    bgcolor: 'background.neutral',
                    borderRadius: 2,
                    '& img': { objectFit: 'cover' },
                  }}
                >
                  <Iconify icon="solar:camera-bold" width={64} sx={{ color: 'text.disabled' }} />
                </Avatar>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h5">{species.common_name ?? scientific}</Typography>
                {format && (
                  <Label variant="soft" color="info">
                    {format}
                  </Label>
                )}
              </Box>
              <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary', mt: -1 }}>
                {scientific}
              </Typography>

              {species.description && (
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                  {species.description}
                </Typography>
              )}
            </Stack>
          </Card>
        </Grid>

        {/* Derecha — Detalles, Ficha de cuidados y Cultivo */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2}>
            <Card sx={{ p: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Detalles
              </Typography>
              <DetailRow label="Grupo" value={species.genus?.group?.name} />
              <DetailRow label="Género" value={species.genus?.name} />
              <DetailRow label="Nombre científico" value={scientific} />
              <DetailRow label="Formato de venta" value={format ?? 'Individual'} />
            </Card>

            {/* Cultivo — privado */}
            <Card sx={{ p: 3, border: (t) => `dashed 1px ${t.vars.palette.divider}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                <Iconify icon="solar:lock-keyhole-bold" width={16} sx={{ color: 'text.disabled' }} />
                <Typography variant="subtitle2">Cultivo (privado)</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Estado de cría
                </Typography>
                <Label variant="soft" color={husbandry.color}>
                  {husbandry.label}
                </Label>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Disponibles
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {units}
                  </Typography>
                  <Label variant="soft" color={stock.color}>
                    {stock.label}
                  </Label>
                </Box>
              </Box>
              <DetailRow
                label="Umbral bajo stock"
                value={species.low_stock_threshold ?? `Global (${DEFAULT_LOW_STOCK})`}
              />
              {species.private_notes && (
                <CareParagraph label="Notas privadas" value={species.private_notes} />
              )}
              {canUpdateSpecies && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Iconify icon="solar:pen-bold" width={16} />}
                  onClick={() => setManage({ row: species, kind: 'species' })}
                  sx={{ mt: 2 }}
                >
                  Gestionar cultivo
                </Button>
              )}
            </Card>
          </Stack>
        </Grid>

        {/* Ficha de cuidados — horizontal, ancho completo */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2.5 }}>
              Ficha de cuidados
            </Typography>
            {hasCareSheet(species) ? (
              <Stack spacing={3}>
                {/* Datos rápidos en fila de mosaicos */}
                <Grid container spacing={1.5}>
                  {[
                    ['Origen', species.origin],
                    ['Temperatura', species.temperature],
                    ['Humedad', species.humidity],
                    ['Tamaño adulto', species.adult_size],
                    ['Dificultad', species.difficulty],
                    ['Rareza', species.rarity],
                  ]
                    .filter(([, v]) => v)
                    .map(([label, value]) => (
                      <Grid key={label} size={{ xs: 6, sm: 4, md: 2 }}>
                        <FactTile label={label} value={value} />
                      </Grid>
                    ))}
                </Grid>

                {/* Textos largos en columnas */}
                <Grid container spacing={3}>
                  <CareColumn label="Hábitat" value={species.habitat} />
                  <CareColumn label="Dieta" value={species.diet} />
                  <CareColumn label="Notas" value={species.notes} />
                </Grid>
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                Sin ficha de cuidados.{canUpdateSpecies ? ' Usa “Editar ficha”.' : ''}
              </Typography>
            )}
          </Card>
        </Grid>

        {/* Morphs — variantes de esta especie, con su cultivo independiente */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box>
                <Typography variant="h6">Morphs</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                  {morphs.length} {morphs.length === 1 ? 'variante' : 'variantes'} · cría y stock
                  independientes de la especie
                </Typography>
              </Box>
              {has('morphs.create') && (
                <Button
                  variant="contained"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                  onClick={() => setDialog({ tab: 'morphs', current: null, initial: { species_id: species.id } })}
                >
                  Añadir morph
                </Button>
              )}
            </Box>

            {morphs.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Iconify icon="solar:leaf-bold" width={40} sx={{ color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Sin morphs registrados
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Morph</TableCell>
                      <TableCell>Descripción</TableCell>
                      <TableCell align="right">Disponibles</TableCell>
                      <TableCell>Stock</TableCell>
                      <TableCell>Cría</TableCell>
                      <TableCell align="right"> </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {morphs.map((morph) => {
                      const mUnits = unitsByMorph[morph.id] ?? 0;
                      const mStock = STOCK[stockStateOf(mUnits, morph.low_stock_threshold ?? DEFAULT_LOW_STOCK)];
                      const mHus = HUSBANDRY[morph.husbandry_status ?? 'active'] ?? HUSBANDRY.active;
                      return (
                        <TableRow key={morph.id} hover>
                          <TableCell sx={{ fontWeight: 500 }}>{morph.name}</TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{morph.description || '—'}</TableCell>
                          <TableCell align="right">{mUnits}</TableCell>
                          <TableCell>
                            <Label variant="soft" color={mStock.color}>
                              {mStock.label}
                            </Label>
                          </TableCell>
                          <TableCell>
                            <Label variant="soft" color={mHus.color}>
                              {mHus.label}
                            </Label>
                          </TableCell>
                          <TableCell align="right">
                            <MoreMenu
                              items={[
                                canUpdateSpecies && {
                                  label: 'Gestionar cultivo',
                                  icon: 'solar:leaf-bold',
                                  onClick: () => setManage({ row: morph, kind: 'morph' }),
                                },
                                canCreateAnimals && {
                                  label: 'Poner a la venta',
                                  icon: 'solar:cart-plus-bold',
                                  onClick: () =>
                                    navigate(
                                      `${paths.dashboard.animal.new}?species_id=${species.id}&morph_id=${morph.id}`
                                    ),
                                },
                                has('morphs.update') && {
                                  label: 'Editar morph',
                                  icon: 'solar:pen-bold',
                                  onClick: () => setDialog({ tab: 'morphs', current: morph }),
                                },
                                has('morphs.delete') && {
                                  label: 'Eliminar',
                                  icon: 'solar:trash-bin-trash-bold',
                                  color: 'error.main',
                                  onClick: () => setToDelete({ kind: 'morph', id: morph.id, name: morph.name }),
                                },
                              ].filter(Boolean)}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>
        </Grid>

        {/* Abajo — Ejemplares (inventario de esta especie) */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box>
                <Typography variant="h6">Ejemplares</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                  {animals.length} {animals.length === 1 ? 'registro' : 'registros'}
                  {isBulk ? ` · ${units} unidades disponibles` : ''}
                </Typography>
              </Box>
              {canCreateAnimals && (
                <Button
                  component={RouterLink}
                  href={`${paths.dashboard.animal.new}?species_id=${species.id}`}
                  variant="contained"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                >
                  Nuevo animal
                </Button>
              )}
            </Box>

            {animals.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Iconify icon="solar:box-bold" width={40} sx={{ color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Sin ejemplares registrados
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Código</TableCell>
                      <TableCell>Morphs</TableCell>
                      <TableCell>Sexo</TableCell>
                      <TableCell>Nacimiento</TableCell>
                      <TableCell>Precio</TableCell>
                      <TableCell>Estado</TableCell>
                      {isBulk && <TableCell>Stock</TableCell>}
                      <TableCell>Doc. legal</TableCell>
                      <TableCell align="right"> </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {animals.map((animal) => (
                      <AnimalRow
                        key={animal.id}
                        animal={animal}
                        showStock={isBulk}
                        canUpdate={canUpdateAnimals}
                        canDelete={canDeleteAnimals}
                        onDelete={(id) => setToDelete({ kind: 'animal', id, name: animal.code })}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>
        </Grid>
      </Grid>

      {dialog && (
        <TaxonDialog
          tab={dialog.tab}
          singular={dialog.tab === 'morphs' ? 'morph' : 'especie'}
          current={dialog.current}
          initial={dialog.initial}
          genera={genera}
          allSpecies={allSpecies}
          groupsFlat={flattenGroupTree(groupTree)}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            if (dialog.tab === 'morphs') await morphsMutate();
            else await onMutate?.();
          }}
        />
      )}

      {manage && (
        <ManageDialog
          species={manage.row}
          title={manage.kind === 'morph' ? manage.row.name : undefined}
          update={manage.kind === 'morph' ? updateMorph : undefined}
          onClose={() => setManage(null)}
          onSaved={async () => {
            if (manage.kind === 'morph') await morphsMutate();
            else await onMutate?.();
          }}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Eliminar"
        content={
          <>
            ¿Estás seguro de eliminar <strong>{toDelete?.name}</strong>?
          </>
        }
        action={
          <Button variant="contained" color="error" onClick={handleConfirmDelete}>
            Eliminar
          </Button>
        }
      />
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------

const CARE_FIELDS = ['origin', 'temperature', 'humidity', 'adult_size', 'difficulty', 'rarity', 'habitat', 'diet', 'notes'];
const hasCareSheet = (sp) => CARE_FIELDS.some((f) => sp[f]);

// Menú "⋮" con acciones etiquetadas: un solo icono en la fila y el texto de
// cada acción a la vista al abrirlo, en vez de una hilera de iconos mudos.
function MoreMenu({ items }) {
  const menu = usePopover();
  if (!items.length) return null;

  return (
    <>
      <IconButton
        size="small"
        color={menu.open ? 'inherit' : 'default'}
        onClick={menu.onOpen}
        aria-label="Más acciones"
      >
        <Iconify icon="eva:more-vertical-fill" />
      </IconButton>

      <CustomPopover
        open={menu.open}
        anchorEl={menu.anchorEl}
        onClose={menu.onClose}
        slotProps={{ arrow: { placement: 'right-top' } }}
      >
        <MenuList>
          {items.map((item) => (
            <MenuItem
              key={item.label}
              sx={item.color ? { color: item.color } : undefined}
              onClick={() => {
                menu.onClose();
                item.onClick();
              }}
            >
              <Iconify icon={item.icon} />
              {item.label}
            </MenuItem>
          ))}
        </MenuList>
      </CustomPopover>
    </>
  );
}

function DetailRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, gap: 2 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary', flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, textAlign: 'right' }}>
        {value}
      </Typography>
    </Box>
  );
}

// Mosaico de dato rápido (origen, temperatura, …) para la ficha horizontal
function FactTile({ label, value }) {
  return (
    <Box sx={{ p: 1.5, height: '100%', borderRadius: 1.5, bgcolor: 'background.neutral' }}>
      <Typography
        variant="caption"
        sx={{ display: 'block', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}
      >
        {label}
      </Typography>
      <Typography variant="subtitle2" sx={{ mt: 0.5 }}>
        {value}
      </Typography>
    </Box>
  );
}

// Columna de texto largo (hábitat, dieta, notas) en la ficha horizontal
function CareColumn({ label, value }) {
  if (!value) return null;
  return (
    <Grid size={{ xs: 12, md: 4 }}>
      <Typography
        variant="overline"
        sx={{ display: 'block', mb: 1, color: 'text.secondary' }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-line', lineHeight: 1.7, color: 'text.secondary' }}>
        {value}
      </Typography>
    </Grid>
  );
}

function CareParagraph({ label, value }) {
  if (!value) return null;
  return (
    <Box sx={{ py: 0.75 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
        {value}
      </Typography>
    </Box>
  );
}
