import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import axiosInstance, { endpoints } from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';
import { checkoutSale, useGetBranches } from 'src/actions/sale';

import { toast } from 'src/components/snackbar';
import { LoadingScreen } from 'src/components/loading-screen';

import { useQuickSale } from '../use-quick-sale';
import { QuickSaleCart } from '../quick-sale-cart';
import { QuickSaleGrid } from '../quick-sale-grid';
import { getKV, setKV } from '../quick-sale-store';
import { QuickSalePicker } from '../quick-sale-picker';

// ----------------------------------------------------------------------

export function QuickSaleView() {
  const router = useRouter();
  const quick = useQuickSale();
  const { reload } = quick;
  const { branches } = useGetBranches();

  // Preferencias del dispositivo: sucursal y si se imprime el ticket
  const [prefs, setPrefs] = useState({ branchId: null, printTicket: true });
  const [picking, setPicking] = useState(false);
  const [charging, setCharging] = useState(false);
  // Una llave por cuenta: repetir el cobro (doble toque, respuesta perdida)
  // devuelve la misma venta en vez de cobrar otra
  const saleKey = useRef(crypto.randomUUID());
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await axiosInstance.get(endpoints.product.quickSale);
      await setKV('catalog', { items: res.data, fetchedAt: new Date().toISOString() });
    } catch {
      // sin red se sigue con el catálogo guardado
    }
    await reload();
  }, [reload]);

  useEffect(() => {
    getKV('prefs').then((saved) => saved && setPrefs((p) => ({ ...p, ...saved })));
    refresh();
  }, [refresh]);

  const savePrefs = (patch) =>
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      setKV('prefs', next);
      return next;
    });

  const branchId = prefs.branchId ?? branches[0]?.id ?? null;

  const charge = async ({ method }) => {
    if (busy.current) return false;
    if (!branchId) {
      toast.error('Elige una sucursal');
      return false;
    }
    busy.current = true;
    setCharging(true);
    try {
      await checkoutSale({
        branch_id: branchId,
        items: quick.cart.map(({ product_id, quantity, discount }) => ({
          product_id,
          quantity,
          discount,
        })),
        payments: [{ method_payment: method, amount: quick.totals.total }],
        idempotency_key: saleKey.current,
      });
      saleKey.current = crypto.randomUUID();
      quick.clear();
      toast.success('Venta registrada');
      await refresh();
      return true;
    } catch (error) {
      toast.error(error?.message || 'No se pudo registrar la venta');
      return false;
    } finally {
      busy.current = false;
      setCharging(false);
    }
  };

  if (!quick.ready) return <LoadingScreen />;

  const addButton = (
    <Button variant="outlined" onClick={() => setPicking(true)}>
      + Agregar productos
    </Button>
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
            <Typography variant="h6">Aún no hay productos en la venta rápida</Typography>
            <Typography variant="body2" sx={{ maxWidth: 420, color: 'text.secondary' }}>
              Marca los productos, animales o paquetes que vas a vender y aparecerán aquí como
              botones.
            </Typography>
            {addButton}
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
            refresh();
          }}
        />
      )}
    </DashboardContent>
  );
}
