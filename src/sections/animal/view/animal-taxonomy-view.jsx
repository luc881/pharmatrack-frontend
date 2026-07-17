import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import { DataGrid, gridClasses } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';

import { handleApiError } from 'src/utils/handle-api-error';

import { DashboardContent } from 'src/layouts/dashboard';
import {
  createGenus,
  updateGenus,
  deleteGenus,
  createMorph,
  updateMorph,
  deleteMorph,
  useAllGenera,
  useAllMorphs,
  createSpecies,
  updateSpecies,
  deleteSpecies,
  useAllSpecies,
  createAnimalGroup,
  updateAnimalGroup,
  deleteAnimalGroup,
  useAnimalGroupTree,
} from 'src/actions/animal';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { CustomGridActionsCellItem } from 'src/components/custom-data-grid';

import { useAuthContext } from 'src/auth/hooks';

import { speciesLabel, saleFormatLabel, flattenGroupTree, SALE_FORMAT_OPTIONS } from '../utils';

// ----------------------------------------------------------------------

const TABS = [
  { value: 'groups', label: 'Grupos', singular: 'grupo', resource: 'animalgroups' },
  { value: 'genera', label: 'Géneros', singular: 'género', resource: 'genera' },
  { value: 'species', label: 'Especies', singular: 'especie', resource: 'species' },
  { value: 'morphs', label: 'Morphs', singular: 'morph', resource: 'morphs' },
];

const ACTIONS = {
  groups: { create: createAnimalGroup, update: updateAnimalGroup, delete: deleteAnimalGroup },
  genera: { create: createGenus, update: updateGenus, delete: deleteGenus },
  species: { create: createSpecies, update: updateSpecies, delete: deleteSpecies },
  morphs: { create: createMorph, update: updateMorph, delete: deleteMorph },
};

// ----------------------------------------------------------------------

export function AnimalTaxonomyView() {
  const theme = useTheme();

  const { user } = useAuthContext();

  const [tabValue, setTabValue] = useState('groups');
  const [morphSpeciesFilter, setMorphSpeciesFilter] = useState('');
  const [dialog, setDialog] = useState(null); // { current } — abierto si no es null
  const [rowToDelete, setRowToDelete] = useState(null);

  const { groupTree, groupTreeLoading, groupTreeMutate } = useAnimalGroupTree();
  const { genera, generaLoading, generaMutate } = useAllGenera();
  const { species: allSpecies, speciesLoading, speciesMutate } = useAllSpecies();
  const { morphs, morphsLoading, morphsMutate } = useAllMorphs(morphSpeciesFilter || undefined);

  const groupsFlat = flattenGroupTree(groupTree);
  const speciesById = Object.fromEntries(allSpecies.map((s) => [s.id, s]));

  const can = (action) =>
    user?.permissions?.includes(`${TABS.find((t) => t.value === tabValue).resource}.${action}`);

  const mutateCurrent = {
    // renombrar/mover un grupo cambia lo que muestran los géneros
    groups: () => Promise.all([groupTreeMutate(), generaMutate()]),
    genera: generaMutate,
    species: speciesMutate,
    morphs: morphsMutate,
  }[tabValue];

  const handleConfirmDelete = useCallback(async () => {
    try {
      await ACTIONS[tabValue].delete(rowToDelete.id);
      await mutateCurrent();
      toast.success('Eliminado correctamente');
    } catch (error) {
      // el backend rechaza con detalle descriptivo si tiene dependencias
      toast.error(error.message || 'Error al eliminar');
    } finally {
      setRowToDelete(null);
    }
  }, [tabValue, rowToDelete, mutateCurrent]);

  const actionsColumn = {
    type: 'actions',
    field: 'actions',
    headerName: ' ',
    width: 64,
    align: 'right',
    headerAlign: 'right',
    sortable: false,
    filterable: false,
    disableColumnMenu: true,
    getActions: (params) => [
      ...(can('update') ? [<CustomGridActionsCellItem showInMenu label="Editar" icon={<Iconify icon="solar:pen-bold" />} onClick={() => setDialog({ current: params.row })} />] : []),
      ...(can('delete') ? [<CustomGridActionsCellItem showInMenu label="Eliminar" icon={<Iconify icon="solar:trash-bin-trash-bold" />} onClick={() => setRowToDelete(params.row)} style={{ color: theme.vars.palette.error.main }} />] : []),
    ],
  };

  const gridProps = {
    groups: {
      rows: groupsFlat,
      loading: groupTreeLoading,
      columns: [
        {
          field: 'name',
          headerName: 'Nombre',
          flex: 1,
          minWidth: 240,
          sortable: false, // el orden del árbol es la jerarquía
          renderCell: (params) => (
            <Box sx={{ pl: params.row.depth * 3 }}>
              {params.row.depth > 0 && '└ '}
              {params.row.name}
            </Box>
          ),
        },
        actionsColumn,
      ],
    },
    genera: {
      rows: genera,
      loading: generaLoading,
      columns: [
        { field: 'name', headerName: 'Nombre', flex: 1, minWidth: 200 },
        { field: 'group', headerName: 'Grupo', flex: 1, minWidth: 160, valueGetter: (v) => v?.name ?? '—' },
        actionsColumn,
      ],
    },
    species: {
      rows: allSpecies,
      loading: speciesLoading,
      columns: [
        { field: 'genus', headerName: 'Género', width: 180, valueGetter: (v) => v?.name ?? '—' },
        { field: 'name', headerName: 'Nombre científico', flex: 1, minWidth: 180 },
        { field: 'common_name', headerName: 'Nombre común', flex: 1, minWidth: 180, valueGetter: (v) => v ?? '—' },
        { field: 'sale_format', headerName: 'Formato', width: 140, valueGetter: (_, row) => saleFormatLabel(row) ?? 'Individual' },
        actionsColumn,
      ],
    },
    morphs: {
      rows: morphs,
      loading: morphsLoading,
      columns: [
        { field: 'species_id', headerName: 'Especie', width: 240, valueGetter: (v) => speciesLabel(speciesById[v]) || '—' },
        { field: 'name', headerName: 'Nombre', flex: 1, minWidth: 160 },
        { field: 'description', headerName: 'Descripción', flex: 1, minWidth: 200, valueGetter: (v) => v ?? '—' },
        actionsColumn,
      ],
    },
  }[tabValue];

  const tabConfig = TABS.find((t) => t.value === tabValue);

  return (
    <>
      <DashboardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <CustomBreadcrumbs
          heading="Taxonomía"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Animales', href: paths.dashboard.animal.root },
            { name: 'Taxonomía' },
          ]}
          action={can('create') && (
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => setDialog({ current: null })}
            >
              {`Nuevo ${tabConfig.singular}`}
            </Button>
          )}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card
          sx={{
            minHeight: 480,
            flexGrow: { md: 1 },
            display: { md: 'flex' },
            height: { xs: 640, md: '1px' },
            flexDirection: { md: 'column' },
          }}
        >
          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            sx={{ px: 2.5, boxShadow: (t) => `inset 0 -2px 0 0 ${t.vars.palette.divider}` }}
          >
            {TABS.map((tab) => (
              <Tab key={tab.value} value={tab.value} label={tab.label} />
            ))}
          </Tabs>

          {tabValue === 'morphs' && (
            <TextField
              select
              size="small"
              label="Filtrar por especie"
              value={morphSpeciesFilter}
              onChange={(e) => setMorphSpeciesFilter(e.target.value)}
              sx={{ m: 2, maxWidth: 320 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {allSpecies.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {speciesLabel(s)}
                </MenuItem>
              ))}
            </TextField>
          )}

          <DataGrid
            disableRowSelectionOnClick
            rows={gridProps.rows}
            columns={gridProps.columns}
            loading={gridProps.loading}
            pageSizeOptions={[25, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            slots={{
              noRowsOverlay: () => <EmptyContent />,
              noResultsOverlay: () => <EmptyContent title="Sin resultados" />,
            }}
            sx={{ [`& .${gridClasses.cell}`]: { display: 'flex', alignItems: 'center' } }}
          />
        </Card>
      </DashboardContent>

      {dialog && (
        <TaxonDialog
          tab={tabValue}
          singular={tabConfig.singular}
          current={dialog.current}
          genera={genera}
          allSpecies={allSpecies}
          groupsFlat={groupsFlat}
          onClose={() => setDialog(null)}
          onSaved={mutateCurrent}
        />
      )}

      <ConfirmDialog
        open={!!rowToDelete}
        onClose={() => setRowToDelete(null)}
        title="Eliminar"
        content={
          <>
            ¿Estás seguro de eliminar <strong>{rowToDelete?.name}</strong>?
          </>
        }
        action={
          <Button variant="contained" color="error" onClick={handleConfirmDelete}>
            Eliminar
          </Button>
        }
      />
    </>
  );
}

// ----------------------------------------------------------------------

function TaxonDialog({ tab, singular, current, genera, allSpecies, groupsFlat, onClose, onSaved }) {
  const isEdit = !!current;

  const [form, setForm] = useState({
    name: current?.name ?? '',
    common_name: current?.common_name ?? '',
    description: current?.description ?? '',
    genus_id: current?.genus_id ?? current?.genus?.id ?? '',
    species_id: current?.species_id ?? '',
    parent_id: current?.parent_id ?? '',
    group_id: current?.group_id ?? current?.group?.id ?? '',
    sale_format: current?.sale_format ?? 'individual',
    package_size: current?.package_size ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Un grupo no puede colgar de sí mismo ni de sus descendientes
  const parentOptions = groupsFlat.filter(
    (g) => !current || (g.id !== current.id && !g.ancestors.includes(current.id))
  );

  const missingParent =
    (tab === 'species' && !form.genus_id) ||
    (tab === 'morphs' && !form.species_id) ||
    (tab === 'species' && form.sale_format === 'package' && !(Number(form.package_size) >= 2));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        groups: { name: form.name, parent_id: form.parent_id ? Number(form.parent_id) : null },
        genera: { name: form.name, group_id: form.group_id ? Number(form.group_id) : null },
        species: {
          genus_id: Number(form.genus_id),
          name: form.name,
          common_name: form.common_name || null,
          sale_format: form.sale_format,
          package_size: form.sale_format === 'package' ? Number(form.package_size) : null,
        },
        morphs: { species_id: Number(form.species_id), name: form.name, description: form.description || null },
      }[tab];

      if (isEdit) {
        await ACTIONS[tab].update(current.id, payload);
      } else {
        await ACTIONS[tab].create(payload);
      }

      toast.success(isEdit ? 'Guardado correctamente' : 'Creado correctamente');
      await onSaved();
      onClose();
    } catch (error) {
      // los duplicados van como error inline en el campo Nombre
      if (!handleApiError(error, (_field, { message }) => setNameError(message))) {
        toast.error(error.message || 'Error al guardar');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open fullWidth maxWidth="xs" onClose={onClose}>
      <DialogTitle>{`${isEdit ? 'Editar' : 'Nuevo'} ${singular}`}</DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {tab === 'groups' && (
          <TextField select label="Grupo padre" value={form.parent_id} onChange={set('parent_id')} sx={{ mt: 1 }}>
            <MenuItem value="">— Raíz —</MenuItem>
            {parentOptions.map((g) => (
              <MenuItem key={g.id} value={g.id} sx={{ pl: 2 + g.depth * 2 }}>
                {g.name}
              </MenuItem>
            ))}
          </TextField>
        )}

        {tab === 'species' && (
          <TextField select label="Género *" value={form.genus_id} onChange={set('genus_id')} sx={{ mt: 1 }}>
            {genera.map((g) => (
              <MenuItem key={g.id} value={g.id}>
                {g.name}
              </MenuItem>
            ))}
          </TextField>
        )}

        {tab === 'morphs' && (
          <TextField select label="Especie *" value={form.species_id} onChange={set('species_id')} sx={{ mt: 1 }}>
            {allSpecies.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {speciesLabel(s)}
              </MenuItem>
            ))}
          </TextField>
        )}

        <TextField
          label={tab === 'species' ? 'Nombre científico *' : 'Nombre *'}
          value={form.name}
          onChange={(e) => {
            setNameError('');
            set('name')(e);
          }}
          error={!!nameError}
          helperText={nameError}
          sx={{ mt: tab === 'genera' ? 1 : 0 }}
        />

        {tab === 'genera' && (
          <TextField select label="Grupo" value={form.group_id} onChange={set('group_id')}>
            <MenuItem value="">Sin grupo</MenuItem>
            {groupsFlat.map((g) => (
              <MenuItem key={g.id} value={g.id} sx={{ pl: 2 + g.depth * 2 }}>
                {g.name}
              </MenuItem>
            ))}
          </TextField>
        )}

        {tab === 'species' && (
          <>
            <TextField label="Nombre común" value={form.common_name} onChange={set('common_name')} />
            <TextField select label="Formato de venta" value={form.sale_format} onChange={set('sale_format')}>
              {SALE_FORMAT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            {form.sale_format === 'package' && (
              <TextField
                type="number"
                label="Ejemplares por paquete *"
                value={form.package_size}
                onChange={set('package_size')}
                slotProps={{ htmlInput: { min: 2 } }}
              />
            )}
          </>
        )}

        {tab === 'morphs' && (
          <TextField label="Descripción" multiline rows={2} value={form.description} onChange={set('description')} />
        )}
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="contained" loading={saving} disabled={!form.name.trim() || missingParent} onClick={handleSave}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
