import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useGetBranches } from 'src/actions/sale';
import { DashboardContent } from 'src/layouts/dashboard';

import { toast } from 'src/components/snackbar';
import { LoadingScreen } from 'src/components/loading-screen';

import { useAuthContext } from 'src/auth/hooks';

import { useQuickSale } from '../use-quick-sale';
import { QuickSaleCart } from '../quick-sale-cart';
import { QuickSaleGrid } from '../quick-sale-grid';
import { getKV, setKV } from '../quick-sale-store';
import { QuickSalePicker } from '../quick-sale-picker';
import { QuickSaleStatus } from '../quick-sale-status';
import {
  retrySale,
  syncQueue,
  enqueueSale,
  exportBackup,
  prepareOffline,
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
  const [savedBranch, setSavedBranch] = useState(null);
  const [picking, setPicking] = useState(false);
  const [charging, setCharging] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  // Una llave por cuenta: tocar «Cobrar» dos veces guarda una sola venta
  const saleKey = useRef(crypto.randomUUID());
  const busy = useRef(false);

  const branchId = prefs.branchId ?? savedBranch ?? branches[0]?.id ?? null;
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
        if (announce) toast.success(`Listo: ${count} productos guardados en este equipo`);
      } catch (error) {
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
    getKV('prefs').then((saved) => saved && setPrefs((p) => ({ ...p, ...saved })));
    getKV('context').then((context) => setSavedBranch(context?.branchId ?? null));
    catchUp();
    window.addEventListener('online', catchUp);
    return () => window.removeEventListener('online', catchUp);
  }, [catchUp]);

  const savePrefs = (patch) =>
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      setKV('prefs', next);
      return next;
    });

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
      await reload();
      // La venta ya está a salvo en el equipo; subirla no detiene la fila
      sync().then((result) => result.synced > 0 && prepare());
      if (prefs.printTicket) {
        router.push(`${paths.dashboard.quickSale.ticket(key)}?print=1`);
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

  if (!quick.ready) return <LoadingScreen />;

  const addButton = (
    <Button variant="outlined" disabled={!online} onClick={() => setPicking(true)}>
      + Agregar productos
    </Button>
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
        <Typography variant="body2" sx={{ maxWidth: 420, color: 'text.secondary' }}>
          Marca los productos, animales o paquetes que vas a vender y aparecerán aquí como botones.
        </Typography>
        {addButton}
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
          {addButton}
          <Button color="inherit" onClick={() => router.push(paths.dashboard.sale.root)}>
            Ver ventas
          </Button>
        </Stack>
      </Stack>

      <QuickSaleStatus
        online={online}
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
        onBackup={exportBackup}
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
          <QuickSaleGrid items={quick.items} stockOf={quick.stockOf} onAdd={quick.add} />
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
          />
        </Box>
      </Box>

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
