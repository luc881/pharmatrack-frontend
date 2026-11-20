import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { matchesWords } from 'src/utils/plain';
import { fDateTime } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

import { useGetBranches } from 'src/actions/sale';
import { DashboardContent } from 'src/layouts/dashboard';

import { toast } from 'src/components/snackbar';
import { LoadingScreen } from 'src/components/loading-screen';

import { PutOnSaleDialog } from 'src/sections/animal/put-on-sale-dialog';

import { useAuthContext } from 'src/auth/hooks';

import { useQuickSale } from '../use-quick-sale';
import { QuickSaleGrid } from '../quick-sale-grid';
import { getKV, setKV } from '../quick-sale-store';
import { QuickSalePicker } from '../quick-sale-picker';
import { PriceDialog, QuickSaleCart } from '../quick-sale-cart';
import { QuickSaleNewProduct } from '../quick-sale-new-product';
import { QuickSaleAddButtons } from '../quick-sale-add-buttons';
import { QuickSaleStatus, QuickSalePriceReview } from '../quick-sale-status';
import {
  retrySale,
  syncQueue,
  shellReady,
  enqueueSale,
  discardSale,
  exportBackup,
  addProvisional,
  prepareOffline,
  provisionalItem,
  removeProvisional,
  resolvePriceChange,
} from '../quick-sale-sync';

// ----------------------------------------------------------------------

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

// ----------------------------------------------------------------------

// La pantalla siempre lee el catálogo guardado en el equipo y siempre cobra
// contra la cola local; subir las ventas es un paso aparte que corre solo
// cuando hay red. Así se comporta igual con internet y sin él.
export function QuickSaleView() {
  const router = useRouter();
  const online = useOnline();
  const { user } = useAuthContext();
  const quick = useQuickSale();
  const { reload } = quick;
  const { branches } = useGetBranches();

  // Preferencias del equipo: sucursal y si se imprime el ticket
  const [prefs, setPrefs] = useState({ branchId: null, printTicket: true });
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [shell, setShell] = useState(true);
  const [picking, setPicking] = useState(false);
  const [newAnimal, setNewAnimal] = useState(false);
  const [query, setQuery] = useState('');
  // null = cerrado; si no, el nombre con el que abre «Producto nuevo»
  const [creating, setCreating] = useState(null);
  const [priceFor, setPriceFor] = useState(null);
  // precio al vuelo: lo mismo que acepta el API
  const canEditPrice = ['admin', 'superadmin'].includes(user?.role);
  const [charging, setCharging] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reprintMenu, setReprintMenu] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  // Hay wifi pero el sistema no responde (red del lugar sin salida, API caído)
  const [reachable, setReachable] = useState(true);
  // Una llave por cuenta: tocar «Cobrar» dos veces guarda una sola venta
  const saleKey = useRef(crypto.randomUUID());
  const busy = useRef(false);

  const branchId = prefs.branchId ?? branches[0]?.id ?? null;
  const branchRef = useRef(branchId);
  branchRef.current = branchId;

  const account = useRef(null);
  account.current = user
    ? {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        displayName: user.displayName,
      }
    : null;

  // Baja catálogo y contexto. Callado al abrir (sin red no es un error);
  // con aviso cuando lo pide el botón.
  const prepare = useCallback(
    async (announce = false) => {
      setPreparing(true);
      try {
        const { count } = await prepareOffline({
          branchId: branchRef.current,
          user: account.current,
        });
        setReachable(true);
        if (announce) toast.success(`Listo: ${count} productos guardados en este equipo`);
      } catch (error) {
        setReachable(Boolean(error?.status) && error.status < 500);
        if (announce) toast.error(error?.message || 'No se pudo preparar. Revisa tu conexión.');
      } finally {
        setPreparing(false);
        await reload();
      }
    },
    [reload]
  );

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await syncQueue();
      setNeedsLogin(result.needsLogin);
      return result;
    } finally {
      setSyncing(false);
      await reload();
    }
  }, [reload]);

  // Al abrir y cada vez que vuelve la red: subir lo pendiente y, ya con el
  // stock del servidor al día, volver a bajar el catálogo
  const catchUp = useCallback(async () => {
    await sync();
    await prepare();
  }, [sync, prepare]);

  useEffect(() => {
    getKV('prefs')
      .catch(() => null)
      .then((saved) => {
        if (saved) setPrefs((p) => ({ ...p, ...saved }));
        setPrefsLoaded(true);
      });
    // Mientras el service worker termina de guardar la app no está «listo»
    const waiting = setTimeout(() => setShell(false), 0);
    shellReady().then((ready) => {
      clearTimeout(waiting);
      setShell(ready);
    });
    catchUp();
    window.addEventListener('online', catchUp);
    // Al volver a esta pestaña (p. ej. tras una alta completa en otra) se baja
    // el catálogo de nuevo: lo recién dado de alta aparece como botón
    const refresh = () => navigator.onLine && prepare();
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('online', catchUp);
      window.removeEventListener('focus', refresh);
    };
  }, [catchUp, prepare]);

  const savePrefs = (patch) =>
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      setKV('prefs', next);
      return next;
    });

  // La sucursal se guarda en el equipo en cuanto se conoce: sin red la lista
  // de sucursales no carga y, sin esto, no habría con cuál cobrar
  useEffect(() => {
    if (prefsLoaded && branchId && prefs.branchId !== branchId) savePrefs({ branchId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsLoaded, branchId]);

  const charge = async ({ method }) => {
    if (busy.current) return false;
    if (!branchId) {
      toast.error('Elige una sucursal');
      return false;
    }
    busy.current = true;
    setCharging(true);
    try {
      const key = saleKey.current;
      const sale = await enqueueSale({
        key,
        cart: quick.cart,
        itemsById: quick.itemsById,
        method,
        branchId,
      });
      if (!sale) return false;
      saleKey.current = crypto.randomUUID();
      quick.clear();
      setQuery('');
      await reload();
      // La venta ya está a salvo en el equipo; subirla no detiene la fila
      sync().then((result) => result.synced > 0 && prepare());
      // Lo que se prepara imprime su orden aunque el ticket esté apagado
      const hasOrder = sale.lines.some((line) => line.needs_prep);
      if (prefs.printTicket || hasOrder) {
        router.push(
          `${paths.dashboard.quickSale.ticket(key)}?print=1${prefs.printTicket ? '' : '&only=order'}`
        );
      } else {
        toast.success(`Venta ${sale.folio} guardada`);
      }
      return true;
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar la venta');
      return false;
    } finally {
      busy.current = false;
      setCharging(false);
    }
  };

  const retry = async (sale) => {
    await retrySale(sale.idempotency_key);
    await sync();
  };

  // «Guardar $X como precio» (price) o «Dejar» (null); al guardar se vuelve
  // a bajar el catálogo para cobrar ya con el precio nuevo
  const resolvePrice = async (entry, price) => {
    setResolving(true);
    try {
      await resolvePriceChange(entry.product_id, price);
      if (price !== null) {
        toast.success(`${entry.title}: precio guardado`);
        await prepare();
      }
      await reload();
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar el precio');
    } finally {
      setResolving(false);
    }
  };

  const discard = async (sale) => {
    const sure = window.confirm(
      `¿Descartar la venta ${sale.folio}? Se borra de este equipo y no quedará registrada en el sistema.`
    );
    if (!sure) return;
    await discardSale(sale.idempotency_key);
    await reload();
  };

  const createProduct = async (values) => {
    const provisional = await addProvisional(values);
    await reload();
    quick.add(provisionalItem(provisional));
    setCreating(null);
    setQuery('');
  };

  const removeProduct = async (item) => {
    const removed = await removeProvisional(item.client_key);
    if (!removed) toast.error('Ese producto ya tiene ventas; no se puede quitar');
    await reload();
  };

  // Cada palabra escrita debe estar en el nombre o la categoría. La tarjeta
  // muestra el precio cambiado en este equipo, si hay
  const found = useMemo(
    () =>
      (quick.items ?? [])
        .filter((item) => matchesWords(`${item.title} ${item.category ?? ''}`, query))
        .map((item) =>
          quick.overrides[item.id] === undefined
            ? item
            : { ...item, price_retail: quick.overrides[item.id] }
        ),
    [quick.items, quick.overrides, query]
  );

  if (!quick.ready) return <LoadingScreen />;

  if (quick.failed) {
    return (
      <DashboardContent maxWidth="xl">
        <Alert severity="error">
          No se pudieron leer los datos guardados en este equipo. Cierra las ventanas privadas o de
          incógnito, revisa que el equipo tenga espacio y vuelve a abrir la venta rápida.
        </Alert>
      </DashboardContent>
    );
  }

  // Los mismos tres botones arriba y en la pantalla vacía
  const addButtons = (
    <QuickSaleAddButtons
      online={online}
      permissions={user?.permissions ?? []}
      onPick={() => setPicking(true)}
      onQuickProduct={() => setCreating('')}
      onQuickAnimal={() => setNewAnimal(true)}
    />
  );

  // Los que aún se pueden quitar: sin subir y sin ventas en este equipo
  const removable = quick.provisionals.filter(
    (p) =>
      !p.server_id &&
      !quick.sales.some((s) => s.lines.some((line) => line.product_id === `local:${p.client_key}`))
  );

  const empty =
    quick.items === null ? (
      <>
        <Typography variant="h6">Prepara la venta rápida con internet antes de salir</Typography>
        <Typography variant="body2" sx={{ maxWidth: 420, color: 'text.secondary' }}>
          Este equipo todavía no tiene guardados los productos. Conéctate a internet y toca
          «Preparar para vender sin internet».
        </Typography>
      </>
    ) : (
      <>
        <Typography variant="h6">Aún no hay productos en la venta rápida</Typography>
        <Typography variant="body2" sx={{ maxWidth: 460, color: 'text.secondary' }}>
          Elige lo que ya tienes en el inventario con «Agregar productos», o da de alta algo nuevo:
          «Alta rápida» pide lo mínimo aquí mismo; «Alta completa» abre el formulario entero en otra
          pestaña. Todo aparecerá aquí como botones.
        </Typography>
        <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
          {addButtons}
        </Stack>
      </>
    );

  return (
    <DashboardContent maxWidth="xl">
      <Stack
        direction="row"
        sx={{
          mb: 3,
          gap: 2,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h4">Venta rápida</Typography>
        <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          {branches.length > 1 && (
            <TextField
              select
              size="small"
              label="Sucursal"
              value={branchId ?? ''}
              onChange={(e) => savePrefs({ branchId: e.target.value })}
              sx={{ minWidth: 160 }}
            >
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          {addButtons}
          {/* tu ticket y el de cada proveedor, con datos de ejemplo */}
          <Button
            color="inherit"
            onClick={() => router.push(paths.dashboard.quickSale.ticket('prueba'))}
          >
            Imprimir prueba
          </Button>
          {/* Las ventas de este equipo (la última semana, también las ya
              subidas): el ticket se arma con lo guardado aquí, sin internet */}
          <Button
            color="inherit"
            disabled={!quick.sales.length}
            onClick={(e) => setReprintMenu(e.currentTarget)}
          >
            Reimprimir ticket
          </Button>
          <Menu anchorEl={reprintMenu} open={!!reprintMenu} onClose={() => setReprintMenu(null)}>
            {quick.sales
              .slice(-20)
              .reverse()
              .map((sale) => (
                <MenuItem
                  key={sale.idempotency_key}
                  component={RouterLink}
                  href={`${paths.dashboard.quickSale.ticket(sale.idempotency_key)}?print=1`}
                >
                  {fDateTime(sale.sold_at)} · {sale.folio} · {fCurrency(sale.totals.total)}
                </MenuItem>
              ))}
          </Menu>
          <Button color="inherit" onClick={() => router.push(paths.dashboard.sale.root)}>
            Ver ventas
          </Button>
        </Stack>
      </Stack>

      <QuickSaleStatus
        online={online}
        reachable={reachable}
        shellReady={shell}
        count={quick.items?.length ?? 0}
        fetchedAt={quick.fetchedAt}
        counts={quick.counts}
        sales={quick.sales}
        needsLogin={needsLogin}
        preparing={preparing}
        syncing={syncing}
        onPrepare={() => prepare(true)}
        onSync={sync}
        onRetry={retry}
        onDiscard={discard}
        onBackup={exportBackup}
      />

      {priceFor !== null && (
        <PriceDialog productId={priceFor} quick={quick} onClose={() => setPriceFor(null)} />
      )}

      <QuickSalePriceReview
        items={quick.priceReview}
        online={online && reachable}
        busy={resolving}
        onResolve={resolvePrice}
      />

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 360px' },
        }}
      >
        {quick.items?.length ? (
          <Stack spacing={2}>
            <TextField
              type="search"
              size="small"
              label="Buscar producto"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              fullWidth
            />
            {found.length ? (
              <QuickSaleGrid
                items={found}
                stockOf={quick.stockOf}
                onAdd={quick.add}
                onPrice={canEditPrice ? (item) => setPriceFor(item.id) : undefined}
                suppliers={quick.suppliers}
                businessName={quick.businessName}
              />
            ) : (
              <Stack spacing={2} sx={{ py: 6, alignItems: 'center', textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Nada con «{query.trim()}»
                </Typography>
                <Button variant="contained" onClick={() => setCreating(query.trim())}>
                  + Producto temporal «{query.trim()}»
                </Button>
              </Stack>
            )}
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ py: 8, alignItems: 'center', textAlign: 'center' }}>
            {empty}
          </Stack>
        )}

        <Box sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
          <QuickSaleCart
            quick={quick}
            charging={charging}
            printTicket={prefs.printTicket}
            onPrintTicketChange={(printTicket) => savePrefs({ printTicket })}
            onCharge={charge}
            canEditPrice={canEditPrice}
          />
        </Box>
      </Box>

      {creating !== null && (
        <QuickSaleNewProduct
          initialTitle={creating}
          suppliers={quick.suppliers}
          removable={removable}
          onCreate={createProduct}
          onRemove={removeProduct}
          onClose={() => setCreating(null)}
        />
      )}

      {newAnimal && (
        <PutOnSaleDialog
          onClose={() => setNewAnimal(false)}
          onDone={() => {
            setNewAnimal(false);
            // ya es botón de la venta rápida: se vuelve a bajar el catálogo
            prepare();
          }}
        />
      )}

      {picking && (
        <QuickSalePicker
          onClose={() => {
            setPicking(false);
            prepare();
          }}
        />
      )}
    </DashboardContent>
  );
}
