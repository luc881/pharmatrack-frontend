import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { DashboardContent } from 'src/layouts/dashboard';
import {
  deleteAnimal,
  useAllGenera,
  useGetAnimals,
  useAllSpecies,
  useAnimalGroupTree,
} from 'src/actions/animal';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
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
  const { user } = useAuthContext();
  const canUpdateSpecies = user?.permissions?.includes('species.update');
  const canUpdateAnimals = user?.permissions?.includes('animals.update');
  const canDeleteAnimals = user?.permissions?.includes('animals.delete');
  const canCreateAnimals = user?.permissions?.includes('animals.create');

  const { animals, animalsMutate } = useGetAnimals({
    page: 1,
    pageSize: 500,
    speciesId: species?.id || undefined,
  });

  // Datos para el diálogo de ficha de cuidados (reusa TaxonDialog)
  const { genera } = useAllGenera();
  const { species: allSpecies } = useAllSpecies();
  const { groupTree } = useAnimalGroupTree();

  const [editSheet, setEditSheet] = useState(false);
  const [manage, setManage] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const handleConfirmDelete = useCallback(async () => {
    try {
      await deleteAnimal(toDelete);
      await animalsMutate();
      toast.success('Ejemplar eliminado');
    } catch (err) {
      toast.error(err.message || 'Error al eliminar');
    } finally {
      setToDelete(null);
    }
  }, [toDelete, animalsMutate]);

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
        backHref={paths.dashboard.animal.root}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Animales', href: paths.dashboard.animal.root },
          { name: species.common_name ?? scientific },
        ]}
        action={
          canUpdateSpecies && (
            <Button
              variant="contained"
              startIcon={<Iconify icon="solar:pen-bold" />}
              onClick={() => setEditSheet(true)}
            >
              Editar ficha
            </Button>
          )
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

            <Card sx={{ p: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Ficha de cuidados
              </Typography>
              {hasCareSheet(species) ? (
                <>
                  <DetailRow label="Origen" value={species.origin} />
                  <DetailRow label="Temperatura" value={species.temperature} />
                  <DetailRow label="Humedad" value={species.humidity} />
                  <DetailRow label="Tamaño adulto" value={species.adult_size} />
                  <DetailRow label="Dificultad" value={species.difficulty} />
                  <DetailRow label="Rareza" value={species.rarity} />
                  <CareParagraph label="Hábitat" value={species.habitat} />
                  <CareParagraph label="Dieta" value={species.diet} />
                  <CareParagraph label="Notas" value={species.notes} />
                </>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                  Sin ficha de cuidados.{canUpdateSpecies ? ' Usa “Editar ficha”.' : ''}
                </Typography>
              )}
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
                  onClick={() => setManage(true)}
                  sx={{ mt: 2 }}
                >
                  Gestionar cultivo
                </Button>
              )}
            </Card>
          </Stack>
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
                  href={paths.dashboard.animal.new}
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
                        onDelete={setToDelete}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>
        </Grid>
      </Grid>

      {editSheet && (
        <TaxonDialog
          tab="species"
          singular="especie"
          current={species}
          genera={genera}
          allSpecies={allSpecies}
          groupsFlat={flattenGroupTree(groupTree)}
          onClose={() => setEditSheet(false)}
          onSaved={async () => {
            await onMutate?.();
          }}
        />
      )}

      {manage && (
        <ManageDialog
          species={species}
          onClose={() => setManage(false)}
          onSaved={async () => {
            await onMutate?.();
          }}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Eliminar"
        content="¿Estás seguro de eliminar este ejemplar?"
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
