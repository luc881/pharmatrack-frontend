import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { useDebounce } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import List from '@mui/material/List';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import ListItem from '@mui/material/ListItem';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import ListItemText from '@mui/material/ListItemText';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { matchesWords } from 'src/utils/plain';
import { fCurrency } from 'src/utils/format-number';

import { fetcher, endpoints } from 'src/lib/axios';
import { useGetAnimals } from 'src/actions/animal';
import {
  useGetProducts,
  toggleProductQuickSale,
  useGetProductCategories,
} from 'src/actions/product';

import { toast } from 'src/components/snackbar';

import { purposeOf } from 'src/sections/animal/utils';
import { PutOnSaleDialog } from 'src/sections/animal/put-on-sale-dialog';

// ----------------------------------------------------------------------

const PAGE = 30;

const scientific = (species) => [species.genus?.name, species.name].filter(Boolean).join(' ');

// «G-2 Tangerine»: código y morphs, lo que distingue a un ejemplar de otro
const animalName = (animal) => [animal.code, ...(animal.morphs ?? []).map((m) => m.name)].join(' ');

// «+ Agregar productos»: elige qué sale como botón en la venta rápida, sin
// salir de ella. Los animales van aparte de los productos: se buscan por
// especie (nombre común o científico) y no por el título de su producto
// gemelo. Necesita internet.
export function QuickSalePicker({ onClose, canCreateAnimals = false }) {
  const [tab, setTab] = useState('animals');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(() => new Set());

  // Marca o desmarca productos (los de `ids`) y avisa si alguno falla
  const toggle = async (ids, after) => {
    setBusy((prev) => new Set([...prev, ...ids]));
    try {
      const results = await Promise.allSettled(ids.map((id) => toggleProductQuickSale(id)));
      const failed = results.find((r) => r.status === 'rejected');
      if (failed) toast.error(failed.reason?.message || 'No se pudo cambiar');
      await after();
    } finally {
      setBusy((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Qué se vende en la venta rápida</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
          <Tab value="animals" label="Animales" />
          <Tab value="products" label="Productos" />
        </Tabs>
        {tab === 'animals' ? (
          <AnimalsTab
            search={search}
            onSearch={setSearch}
            busy={busy}
            onToggle={toggle}
            canCreate={canCreateAnimals}
          />
        ) : (
          <ProductsTab search={search} onSearch={setSearch} busy={busy} onToggle={toggle} />
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Listo
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

// Buscador con sugerencias (se puede escribir cualquier cosa) y un filtro al
// lado: grupo para los animales, categoría para los productos
function Toolbar({ search, onSearch, suggestions, filterLabel, filter, onFilter, filterOptions }) {
  return (
    <Stack direction="row" spacing={2}>
      <Autocomplete
        freeSolo
        size="small"
        options={suggestions}
        inputValue={search}
        onInputChange={(_, value) => onSearch(value)}
        filterOptions={(options, { inputValue }) =>
          options.filter((option) => matchesWords(option, inputValue)).slice(0, 8)
        }
        renderInput={(params) => <TextField {...params} autoFocus label="Buscar" />}
        sx={{ flex: 2 }}
      />
      <TextField
        select
        size="small"
        label={filterLabel}
        value={filter}
        onChange={(e) => onFilter(e.target.value)}
        slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        sx={{ flex: 1, minWidth: 140 }}
      >
        <MenuItem value="">Todos</MenuItem>
        {filterOptions.map((option) => (
          <MenuItem key={option.id} value={option.id}>
            {option.name}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}

// ----------------------------------------------------------------------

function AnimalsTab({ search, onSearch, busy, onToggle, canCreate }) {
  const [group, setGroup] = useState('');
  const [creating, setCreating] = useState(false);
  // ponytail: una página de 500 (tope del API), igual que la lista de animales
  const { animals, animalsLoading, animalsMutate } = useGetAnimals({ page: 1, pageSize: 500 });
  // Lo ya marcado sale del catálogo de la venta rápida (una sola petición)
  const { data: catalog, mutate } = useSWR(endpoints.product.quickSale, fetcher, {
    revalidateOnFocus: false,
  });
  const marked = useMemo(() => new Set((catalog ?? []).map((item) => item.id)), [catalog]);

  // solo lo que se puede cobrar: en venta y disponible
  const onSale = useMemo(
    () => animals.filter((a) => a.species && a.status === 'available' && purposeOf(a) === 'sale'),
    [animals]
  );

  // Filtro y sugerencias salen de lo que hay en venta, no del catálogo entero
  const groupOptions = useMemo(() => {
    const byId = new Map();
    onSale.forEach((a) => {
      const g = a.species.genus?.group;
      if (g) byId.set(g.id, g);
    });
    return [...byId.values()].sort((x, y) => x.name.localeCompare(y.name));
  }, [onSale]);
  const suggestions = useMemo(
    () =>
      [...new Set(onSale.map((a) => a.species.common_name ?? scientific(a.species)))].sort((x, y) =>
        x.localeCompare(y)
      ),
    [onSale]
  );

  const groups = useMemo(() => {
    const bySpecies = new Map();
    onSale
      .filter((a) => group === '' || a.species.genus?.group?.id === group)
      .filter((a) =>
        matchesWords(
          `${a.species.common_name ?? ''} ${scientific(a.species)} ${animalName(a)}`,
          search
        )
      )
      .forEach((a) => {
        if (!bySpecies.has(a.species.id))
          bySpecies.set(a.species.id, { species: a.species, animals: [] });
        bySpecies.get(a.species.id).animals.push(a);
      });
    return [...bySpecies.values()].sort((x, y) =>
      (x.species.common_name ?? scientific(x.species)).localeCompare(
        y.species.common_name ?? scientific(y.species)
      )
    );
  }, [onSale, group, search]);

  const toolbar = (
    <>
      <Toolbar
        search={search}
        onSearch={onSearch}
        suggestions={suggestions}
        filterLabel="Grupo"
        filter={group}
        onFilter={setGroup}
        filterOptions={groupOptions}
      />
      {/* algo que aún no está en venta: alta corta, ya como botón */}
      {canCreate && (
        <Button size="small" onClick={() => setCreating(true)} sx={{ mt: 1 }}>
          + Animal nuevo
        </Button>
      )}
      {creating && (
        <PutOnSaleDialog
          animals={animals}
          onClose={() => setCreating(false)}
          onDone={async () => {
            setCreating(false);
            await Promise.all([animalsMutate(), mutate()]);
          }}
        />
      )}
    </>
  );

  if (!animalsLoading && groups.length === 0) {
    return (
      <>
        {toolbar}
        <Typography variant="body2" sx={{ mt: 3, color: 'text.secondary' }}>
          {search || group !== ''
            ? 'Ningún animal en venta coincide con la búsqueda.'
            : 'No hay animales en venta. Ponlos en venta en Animales → «En venta».'}
        </Typography>
      </>
    );
  }

  const sections = groups.map(({ species, animals: list }) => {
    const name = species.common_name ?? scientific(species);
    const pending = list.filter((a) => !marked.has(a.product_id)).map((a) => a.product_id);
    return (
      <Box key={species.id} component="section" aria-label={name} sx={{ mt: 2.5 }}>
        <Stack
          direction="row"
          sx={{ gap: 2, alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Box>
            <Typography variant="subtitle2">{name}</Typography>
            <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
              {scientific(species)}
            </Typography>
          </Box>
          {pending.length > 0 && (
            <Button
              size="small"
              aria-label={`Marcar todos: ${name}`}
              disabled={pending.some((id) => busy.has(id))}
              onClick={() => onToggle(pending, mutate)}
            >
              Marcar todos ({pending.length})
            </Button>
          )}
        </Stack>
        <List dense disablePadding>
          {list.map((animal) => (
            <ListItem
              key={animal.id}
              disableGutters
              secondaryAction={
                <Switch
                  edge="end"
                  checked={marked.has(animal.product_id)}
                  disabled={busy.has(animal.product_id)}
                  onChange={() => onToggle([animal.product_id], mutate)}
                  slotProps={{ input: { 'aria-label': `Venta rápida: ${animalName(animal)}` } }}
                />
              }
            >
              <ListItemText
                primary={animalName(animal)}
                secondary={[
                  fCurrency(animal.price),
                  Number(animal.stock) > 1 ? `${animal.stock} disponibles` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    );
  });

  return (
    <>
      {toolbar}
      {sections}
    </>
  );
}

// ----------------------------------------------------------------------

function ProductsTab({ search, onSearch, busy, onToggle }) {
  const debounced = useDebounce(search, 300);
  const [size, setSize] = useState(PAGE);
  const [category, setCategory] = useState('');
  const { categories } = useGetProductCategories();
  const { products, productsTotal, productsLoading, productsMutate } = useGetProducts({
    search: debounced,
    pageSize: size,
    isActive: true,
    ordering: 'title',
    categoryId: category || null,
    // los animales tienen su propia pestaña
    excludeAnimalTwins: true,
  });
  const more = productsTotal - products.length;

  return (
    <>
      <Toolbar
        search={search}
        onSearch={onSearch}
        suggestions={products.map((product) => product.title)}
        filterLabel="Categoría"
        filter={category}
        onFilter={setCategory}
        filterOptions={categories}
      />
      <List>
        {products.map((product) => (
          <ListItem
            key={product.id}
            disableGutters
            secondaryAction={
              <Switch
                edge="end"
                checked={Boolean(product.quick_sale)}
                disabled={busy.has(product.id)}
                onChange={() => onToggle([product.id], productsMutate)}
                slotProps={{ input: { 'aria-label': `Venta rápida: ${product.title}` } }}
              />
            }
          >
            <ListItemText primary={product.title} secondary={fCurrency(product.price_retail)} />
          </ListItem>
        ))}
      </List>
      {more > 0 && (
        <Button fullWidth onClick={() => setSize((prev) => prev + Math.min(more, 100))}>
          Ver más ({more})
        </Button>
      )}
      {!productsLoading && products.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Ningún producto coincide con la búsqueda.
        </Typography>
      )}
    </>
  );
}
