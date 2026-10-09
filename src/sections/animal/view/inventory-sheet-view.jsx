import useSWR from 'swr';
import { useMemo, useState, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import { DataGrid, gridClasses } from '@mui/x-data-grid';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';

import { fCurrency } from 'src/utils/format-number';

import { fetcher, endpoints } from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';
import { updateAnimal, useGetAnimals, useAllSpecies } from 'src/actions/animal';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

import { STATUS_LABELS, STATUS_COLORS } from '../utils';

// ----------------------------------------------------------------------
// Hoja de inventario: el Excel de la convención, pero sobre el inventario real.
// Cada fila es un animal/cepa; editar precio o cantidad guarda en el animal
// (sitio y POS). El descuento es solo de vista: calcula el precio con
// descuento como la fórmula del Excel, ROUND(precio × (1 − %)), sin tocar
// los precios guardados. Vendidos e ingreso salen de las ventas completadas
// del POS en el rango de fechas elegido.
// ----------------------------------------------------------------------

const DISCOUNT_KEY = 'inventory-sheet-discount';

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// Día local completo → instantes UTC (las ventas se guardan en UTC)
const dayStartUtc = (d) => new Date(`${d}T00:00:00`).toISOString();
const dayEndUtc = (d) => new Date(`${d}T23:59:59.999`).toISOString();

const readDiscount = () => {
  try {
    const v = Number(localStorage.getItem(DISCOUNT_KEY));
    return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 0;
  } catch {
    return 0;
  }
};

const withDiscount = (price, pct) => (price == null ? null : Math.round(price * (1 - pct / 100)));

const categoryOf = (species) => species?.genus?.group?.name ?? 'Sin grupo';

const money = (v) => (v == null ? '—' : fCurrency(v));

export function InventorySheetView() {
  const { user } = useAuthContext();
  const canEdit = user?.permissions?.includes('animals.update');

  const [discount, setDiscount] = useState(readDiscount);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [tab, setTab] = useState('all');

  const { animals, animalsLoading, animalsMutate } = useGetAnimals({ page: 1, pageSize: 500 });
  const { species } = useAllSpecies();

  // Ventas completadas del rango, por producto (cada animal tiene su producto gemelo)
  const summaryUrl = [endpoints.sale.summary, { params: { date_from: dayStartUtc(from), date_to: dayEndUtc(to) } }];
  const { data: summary } = useSWR(summaryUrl, fetcher, { revalidateOnFocus: false });

  const soldByProduct = useMemo(
    () => new Map((summary?.by_product ?? []).map((p) => [p.product_id, p])),
    [summary]
  );

  const rows = useMemo(
    () =>
      animals.map((a) => {
        const sold = soldByProduct.get(a.product_id);
        const stock = a.stock ?? 0;
        return {
          id: a.id,
          category: categoryOf(a.species),
          species: [a.species?.genus?.name, a.species?.name].filter(Boolean).join(' '),
          common: a.species?.common_name ?? '',
          morph: a.morphs.map((m) => m.name).join(', '),
          code: a.code,
          perPackage:
            a.species?.sale_format === 'package'
              ? a.species.package_size
              : a.species?.sale_format === 'colony'
                ? 'Cepa'
                : 1,
          price: a.price,
          stock,
          sold: sold?.quantity ?? 0,
          revenue: sold?.total ?? 0,
          status: a.status,
          bulk: a.species?.sale_format !== 'individual',
        };
      }),
    [animals, soldByProduct]
  );

  // "En cultivo": especies activas en cría sin nada a la venta (como la
  // segunda tabla de cada hoja del Excel)
  const inCulture = useMemo(() => {
    const forSale = new Set(animals.filter((a) => (a.stock ?? 0) > 0).map((a) => a.species_id));
    return species
      .filter((sp) => (sp.husbandry_status ?? 'active') === 'active' && !forSale.has(sp.id))
      .map((sp) => ({
        id: sp.id,
        category: categoryOf(sp),
        name: [sp.genus?.name, sp.name].filter(Boolean).join(' '),
        common: sp.common_name ?? '',
        notes: sp.private_notes ?? '',
      }));
  }, [animals, species]);

  const categories = useMemo(
    () => [...new Set([...rows.map((r) => r.category), ...inCulture.map((s) => s.category)])].sort(),
    [rows, inCulture]
  );

  // Resumen por categoría (la hoja "Resumen" del Excel)
  const resumen = useMemo(() => {
    const byCat = categories.map((cat) => {
      const r = rows.filter((x) => x.category === cat);
      return {
        cat,
        forSale: new Set(r.filter((x) => x.stock > 0).map((x) => x.species)).size,
        inCulture: inCulture.filter((s) => s.category === cat).length,
        units: r.reduce((n, x) => n + x.stock, 0),
        sold: r.reduce((n, x) => n + x.sold, 0),
        value: r.reduce((n, x) => n + x.price * x.stock, 0),
        valueDisc: r.reduce((n, x) => n + withDiscount(x.price, discount) * x.stock, 0),
        revenue: r.reduce((n, x) => n + x.revenue, 0),
      };
    });
    const total = byCat.reduce(
      (t, c) => ({
        forSale: t.forSale + c.forSale,
        inCulture: t.inCulture + c.inCulture,
        units: t.units + c.units,
        sold: t.sold + c.sold,
        value: t.value + c.value,
        valueDisc: t.valueDisc + c.valueDisc,
        revenue: t.revenue + c.revenue,
      }),
      { forSale: 0, inCulture: 0, units: 0, sold: 0, value: 0, valueDisc: 0, revenue: 0 }
    );
    return { byCat, total };
  }, [categories, rows, inCulture, discount]);

  const visibleRows = tab === 'all' ? rows : rows.filter((r) => r.category === tab);
  const visibleCulture = tab === 'all' ? inCulture : inCulture.filter((s) => s.category === tab);

  const handleDiscount = (e) => {
    const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
    setDiscount(v);
    try {
      localStorage.setItem(DISCOUNT_KEY, String(v));
    } catch {
      // sin almacenamiento (modo privado): el descuento vive solo en esta visita
    }
  };

  // Guarda en el animal real lo que se editó en la celda
  const processRowUpdate = useCallback(
    async (newRow, oldRow) => {
      const payload = {};
      if (newRow.price !== oldRow.price) payload.price = Number(newRow.price);
      if (newRow.stock !== oldRow.stock) payload.stock = Number(newRow.stock);
      if (!Object.keys(payload).length) return oldRow;

      const saved = await updateAnimal(newRow.id, payload);
      animalsMutate();
      toast.success(payload.stock === 0 ? 'Guardado: queda como agotado' : 'Guardado');
      return { ...newRow, price: saved.price, stock: saved.stock ?? newRow.stock, status: saved.status };
    },
    [animalsMutate]
  );

  const columns = useMemo(
    () => [
      { field: 'category', headerName: 'Categoría', width: 130 },
      {
        field: 'species',
        headerName: 'Especie',
        flex: 1,
        minWidth: 200,
        renderCell: ({ row }) => (
          <Stack sx={{ py: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontStyle: 'italic' }} noWrap>
              {row.species}
            </Typography>
            {row.common && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {row.common}
              </Typography>
            )}
          </Stack>
        ),
      },
      { field: 'morph', headerName: 'Variedad / Morph', width: 150 },
      {
        field: 'price',
        headerName: 'Precio',
        type: 'number',
        width: 110,
        editable: canEdit,
        valueFormatter: (v) => money(v),
        preProcessEditCellProps: ({ props }) => ({ ...props, error: !(Number(props.value) >= 0) }),
      },
      {
        field: 'discounted',
        headerName: discount ? `Con ${discount}% desc.` : 'Con descuento',
        type: 'number',
        width: 130,
        valueGetter: (v, row) => withDiscount(row.price, discount),
        valueFormatter: (v) => money(v),
        cellClassName: 'sheet-discount',
      },
      { field: 'perPackage', headerName: 'Por paquete', width: 105, align: 'center', headerAlign: 'center' },
      {
        field: 'stock',
        headerName: 'Cantidad',
        type: 'number',
        width: 100,
        editable: canEdit,
        description: 'Unidades disponibles. Pon 0 si ya no tienes: queda como agotado en el sitio.',
        preProcessEditCellProps: ({ props, row }) => {
          const n = Number(props.value);
          const ok = Number.isInteger(n) && n >= 0 && (row.bulk || n <= 1);
          return { ...props, error: !ok };
        },
      },
      { field: 'sold', headerName: 'Vendidos', type: 'number', width: 95 },
      {
        field: 'value',
        headerName: 'Valor inventario',
        type: 'number',
        width: 140,
        valueGetter: (v, row) => row.price * row.stock,
        valueFormatter: (v) => money(v),
      },
      {
        field: 'revenue',
        headerName: 'Ingreso ventas',
        type: 'number',
        width: 130,
        valueFormatter: (v) => money(v),
      },
      {
        field: 'status',
        headerName: 'Estado',
        width: 115,
        valueFormatter: (v) => STATUS_LABELS[v] ?? v,
        renderCell: ({ row }) => (
          <Label variant="soft" color={row.stock === 0 ? 'default' : STATUS_COLORS[row.status] ?? 'default'}>
            {row.stock === 0 ? 'Agotado' : STATUS_LABELS[row.status] ?? row.status}
          </Label>
        ),
      },
      { field: 'code', headerName: 'Código', width: 130 },
    ],
    [canEdit, discount]
  );

  return (
    <DashboardContent maxWidth={false}>
      <CustomBreadcrumbs
        heading="Hoja de inventario"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Animales', href: paths.dashboard.animal.root },
          { name: 'Hoja de inventario' },
        ]}
        sx={{ mb: 3 }}
      />

      {/* Controles: descuento (solo vista) y rango de ventas */}
      <Card sx={{ p: 2.5, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <TextField
            label="Descuento"
            type="number"
            value={discount}
            onChange={handleDiscount}
            helperText="Solo para ver precios; no cambia los precios guardados"
            slotProps={{
              htmlInput: { min: 0, max: 100, step: 1 },
              input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
            }}
            sx={{ width: { md: 240 } }}
          />
          <TextField
            label="Ventas desde"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="Vendidos e ingreso salen del POS"
          />
          <TextField
            label="Hasta"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText=" "
          />
        </Stack>
      </Card>

      {/* Resumen por categoría */}
      <Card sx={{ mb: 3 }}>
        <CardHeader title="Resumen" sx={{ mb: 1 }} />
        <Scrollbar>
          <Table size="small" sx={{ minWidth: 820 }}>
            <TableHead>
              <TableRow>
                <TableCell>Categoría</TableCell>
                <TableCell align="right">Especies en venta</TableCell>
                <TableCell align="right">En cultivo</TableCell>
                <TableCell align="right">Unidades</TableCell>
                <TableCell align="right">Vendidos</TableCell>
                <TableCell align="right">Valor inventario</TableCell>
                <TableCell align="right">{discount ? `Valor con ${discount}%` : 'Valor con descuento'}</TableCell>
                <TableCell align="right">Ingreso ventas</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resumen.byCat.map((c) => (
                <TableRow key={c.cat} hover>
                  <TableCell>{c.cat}</TableCell>
                  <TableCell align="right">{c.forSale}</TableCell>
                  <TableCell align="right">{c.inCulture}</TableCell>
                  <TableCell align="right">{c.units}</TableCell>
                  <TableCell align="right">{c.sold}</TableCell>
                  <TableCell align="right">{money(c.value)}</TableCell>
                  <TableCell align="right">{money(c.valueDisc)}</TableCell>
                  <TableCell align="right">{money(c.revenue)}</TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ '& td': { fontWeight: 'fontWeightSemiBold', borderTop: (t) => `2px solid ${t.vars.palette.divider}` } }}>
                <TableCell>Total</TableCell>
                <TableCell align="right">{resumen.total.forSale}</TableCell>
                <TableCell align="right">{resumen.total.inCulture}</TableCell>
                <TableCell align="right">{resumen.total.units}</TableCell>
                <TableCell align="right">{resumen.total.sold}</TableCell>
                <TableCell align="right">{money(resumen.total.value)}</TableCell>
                <TableCell align="right">{money(resumen.total.valueDisc)}</TableCell>
                <TableCell align="right">{money(resumen.total.revenue)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Scrollbar>
      </Card>

      {/* Una pestaña por categoría, como las hojas del Excel */}
      <Card sx={{ mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          variant="scrollable"
          sx={{ px: 2.5, boxShadow: (t) => `inset 0 -2px 0 0 ${t.vars.palette.divider}` }}
        >
          <Tab value="all" label="Todas" />
          {categories.map((c) => (
            <Tab key={c} value={c} label={c} />
          ))}
        </Tabs>

        <Typography variant="subtitle2" sx={{ px: 2.5, pt: 2 }}>
          En venta
          {canEdit && (
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              Doble clic en Precio o Cantidad para editar; Enter guarda.
            </Typography>
          )}
        </Typography>

        <DataGrid
          rows={visibleRows}
          columns={columns}
          loading={animalsLoading}
          showToolbar
          disableRowSelectionOnClick
          ignoreDiacritics
          getRowHeight={() => 'auto'}
          processRowUpdate={processRowUpdate}
          onProcessRowUpdateError={(err) => toast.error(err?.message || 'No se pudo guardar')}
          isCellEditable={({ field, row }) => field !== 'stock' || row.bulk || row.stock <= 1}
          columnVisibilityModel={{ category: tab === 'all', code: false }}
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 100 } } }}
          slots={{ noRowsOverlay: () => <EmptyContent title="Sin animales" /> }}
          slotProps={{
            toolbar: {
              printOptions: { hideFooter: true, hideToolbar: true },
              csvOptions: { fileName: `inventario-${today()}`, utf8WithBom: true },
            },
          }}
          sx={{
            border: 0,
            minHeight: 320,
            [`& .${gridClasses.cell}`]: { display: 'flex', alignItems: 'center' },
            '& .sheet-discount': { fontWeight: 700, color: 'text.primary' },
            [`& .${gridClasses['cell--editable']}`]: { bgcolor: 'action.hover', cursor: 'cell' },
          }}
        />

        {visibleCulture.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ px: 2.5, pt: 3, pb: 1 }}>
              En cultivo ({visibleCulture.length})
            </Typography>
            <Scrollbar>
              <Table size="small" sx={{ minWidth: 560, mb: 2 }}>
                <TableHead>
                  <TableRow>
                    {tab === 'all' && <TableCell>Categoría</TableCell>}
                    <TableCell>Especie</TableCell>
                    <TableCell>Notas privadas</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleCulture.map((s) => (
                    <TableRow key={s.id} hover>
                      {tab === 'all' && <TableCell>{s.category}</TableCell>}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                          {s.name}
                        </Typography>
                        {s.common && (
                          <Typography variant="caption" color="text.secondary">
                            {s.common}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{s.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Scrollbar>
          </>
        )}
      </Card>
    </DashboardContent>
  );
}
