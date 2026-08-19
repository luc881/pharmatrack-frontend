import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { Toolbar, DataGrid, gridClasses } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';

import axiosInstance, { endpoints } from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';
import { useGetProducts, toggleProductOnline, useGetProductCategories } from 'src/actions/product';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { ToolbarContainer, ToolbarLeftPanel } from 'src/components/custom-data-grid';

import { useAuthContext } from 'src/auth/hooks';

import { RenderCellPrice, RenderCellProduct } from '../product-table-row';

// ----------------------------------------------------------------------

const TABS = [
  { value: 'online', label: 'En el sitio', showOnline: true },
  { value: 'offline', label: 'Fuera del sitio', showOnline: false },
];

// El stock no viaja con la lista de productos (solo el detalle lo trae, vía
// sus lotes), así que se agrega aparte. Mismo patrón que usa el formulario de
// venta para saber qué productos tienen existencias: trae todos los lotes una
// vez y suma por producto, en vez de pedir el stock producto por producto.
function useStockByProduct() {
  const [stockMap, setStockMap] = useState(null); // null = cargando

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const PAGE_SIZE = 500;
      const first = await axiosInstance
        .get(endpoints.productBatch.list, { params: { page: 1, page_size: PAGE_SIZE } })
        .then((r) => r.data);
      let items = first.data ?? [];
      if ((first.total ?? 0) > PAGE_SIZE) {
        const remaining = Math.ceil(first.total / PAGE_SIZE) - 1;
        const pages = await Promise.all(
          Array.from({ length: remaining }, (_, i) =>
            axiosInstance
              .get(endpoints.productBatch.list, { params: { page: i + 2, page_size: PAGE_SIZE } })
              .then((r) => r.data.data)
          )
        );
        items = [...items, ...pages.flat()];
      }
      if (cancelled) return;
      const map = {};
      items.forEach((b) => {
        map[b.product_id] = (map[b.product_id] ?? 0) + Number(b.quantity);
      });
      setStockMap(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return stockMap;
}

// ----------------------------------------------------------------------

export function ProductOnlineView() {
  const { user } = useAuthContext();
  const canUpdate = user?.permissions?.includes('products.update');

  const [tab, setTab] = useState('online');
  const [localSearch, setLocalSearch] = useState('');
  const [search, setSearch] = useState('');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const [togglingId, setTogglingId] = useState(null);

  const { categories } = useGetProductCategories();
  const categoriesMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);

  const stockMap = useStockByProduct();

  const tabConfig = TABS.find((t) => t.value === tab);

  const { products, productsTotal, productsLoading, productsMutate } = useGetProducts({
    page: paginationModel.page + 1,
    pageSize: paginationModel.pageSize,
    search,
    showOnline: tabConfig.showOnline,
    // los animales viven en su propia sección; sus gemelos POS no van aquí
    excludeAnimalTwins: true,
  });

  const rowCountRef = useRef(productsTotal);
  if (productsTotal > 0) rowCountRef.current = productsTotal;
  const stableRowCount = rowCountRef.current;

  const handleTabChange = useCallback((_, value) => {
    setTab(value);
    setPaginationModel((p) => ({ ...p, page: 0 }));
  }, []);

  const handleSearchSubmit = useCallback(() => {
    setSearch(localSearch);
    setPaginationModel((p) => ({ ...p, page: 0 }));
  }, [localSearch]);

  const handleToggle = useCallback(
    async (row) => {
      setTogglingId(row.id);
      try {
        await toggleProductOnline(row.id);
        await productsMutate();
      } catch (error) {
        toast.error(error?.message || 'No se pudo actualizar');
      } finally {
        setTogglingId(null);
      }
    },
    [productsMutate]
  );

  const columns = useMemo(
    () => [
      {
        field: 'title',
        headerName: 'Producto',
        flex: 1,
        minWidth: 280,
        sortable: false,
        renderCell: (params) => (
          <RenderCellProduct params={params} href={paths.dashboard.product.details(params.row.id)} />
        ),
      },
      {
        field: 'category',
        headerName: 'Categoría',
        width: 160,
        sortable: false,
        valueGetter: (_, row) => categoriesMap[row.product_category_id] ?? '—',
      },
      {
        field: 'price_retail',
        headerName: 'Precio',
        width: 100,
        sortable: false,
        renderCell: (params) => <RenderCellPrice params={params} />,
      },
      {
        field: 'stock',
        headerName: 'Stock',
        width: 90,
        sortable: false,
        renderCell: (params) => (stockMap ? (stockMap[params.row.id] ?? 0) : '…'),
      },
      {
        field: 'show_online',
        headerName: 'En el sitio',
        width: 240,
        sortable: false,
        renderCell: (params) => {
          const { row } = params;
          // Un producto puede tener show_online prendido y no aparecer en el
          // sitio si is_active está apagado: ese desajuste es la razón de ser
          // de esta pantalla, así que se marca con una advertencia visible.
          const notVisible = row.show_online && !row.is_active;
          return (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Switch
                checked={!!row.show_online}
                disabled={!canUpdate || togglingId === row.id}
                onChange={() => handleToggle(row)}
              />
              {notVisible && (
                <Label variant="soft" color="warning">
                  No visible: inactivo
                </Label>
              )}
            </Stack>
          );
        },
      },
    ],
    [categoriesMap, stockMap, togglingId, canUpdate, handleToggle]
  );

  return (
    <DashboardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
      <CustomBreadcrumbs
        heading="Productos del sitio"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Sitio web' },
          { name: 'Productos' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card
        sx={{
          minHeight: 640,
          flexGrow: { md: 1 },
          display: { md: 'flex' },
          height: { xs: 800, md: '1px' },
          flexDirection: { md: 'column' },
        }}
      >
        <Tabs
          value={tab}
          onChange={handleTabChange}
          sx={{ px: 2.5, boxShadow: (t) => `inset 0 -2px 0 0 ${t.vars.palette.divider}` }}
        >
          {TABS.map((t) => (
            <Tab key={t.value} value={t.value} label={t.label} />
          ))}
        </Tabs>

        <DataGrid
          disableRowSelectionOnClick
          disableColumnMenu
          rows={products}
          columns={columns}
          getRowId={(row) => row.id}
          loading={productsLoading}
          rowHeight={72}
          paginationMode="server"
          rowCount={stableRowCount}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[20, 50, 100]}
          slots={{
            noRowsOverlay: () => (
              <EmptyContent title={search ? `Sin resultados para "${search}"` : undefined} />
            ),
            toolbar: () => (
              <Toolbar>
                <ToolbarContainer>
                  <ToolbarLeftPanel>
                    <TextField
                      size="small"
                      value={localSearch}
                      onChange={(e) => setLocalSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                      placeholder="Buscar y presiona Enter..."
                      sx={{ width: 1, maxWidth: { md: 260 } }}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                  </ToolbarLeftPanel>
                </ToolbarContainer>
              </Toolbar>
            ),
          }}
          sx={{
            [`& .${gridClasses.cell}`]: { display: 'flex', alignItems: 'center' },
          }}
        />
      </Card>
    </DashboardContent>
  );
}
