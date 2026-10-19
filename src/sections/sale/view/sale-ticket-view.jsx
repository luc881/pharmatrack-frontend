import useSWR from 'swr';
import { useRef, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useSearchParams } from 'src/routes/hooks';

import axiosInstance, { fetcher } from 'src/lib/axios';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { SaleTicket } from '../sale-ticket';
import { SAMPLE_TICKET, useSaleTicket } from '../print-ticket';

// ----------------------------------------------------------------------
// Vista imprimible del ticket, fuera del layout del dashboard para que solo
// salga el ticket en el rollo. ?print=1 (viene del POS) imprime al cargar.
// Sin saleId imprime el ticket de prueba.
// ----------------------------------------------------------------------

// Área imprimible de cada rollo (lo mismo que .od-ticket en sale-ticket.jsx)
const PRINTABLE = { 58: 48, 80: 72 };
const SETTINGS_URL = '/api/v1/settings/ticket-print';
const DEFAULTS = { width: 80, offset: 0 };

// Antes el ajuste vivía en el navegador; se lee solo para subirlo a la cuenta
const readLocal = (key) => {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};

// Rollo y ajuste horizontal guardados en la cuenta (API /settings/ticket-print)
function useTicketPrintSettings() {
  const { data, error, mutate } = useSWR(SETTINGS_URL, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  const timer = useRef();

  // Los clics seguidos (0.1 mm) se mandan como un solo guardado
  const save = useCallback(
    (next) => {
      mutate({ ...next, saved: true }, { revalidate: false });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        axiosInstance
          .put(SETTINGS_URL, next)
          .catch(() => toast.error('No se pudo guardar el ajuste de la impresora'));
      }, 400);
    },
    [mutate]
  );

  useEffect(() => {
    if (!data || data.saved) return;
    const local = {
      width: readLocal('ticketWidth') === 58 ? 58 : 80,
      offset: readLocal('ticketOffset'),
    };
    if (local.width !== DEFAULTS.width || local.offset) save(local);
  }, [data, save]);

  // Sin API (p. ej. versión vieja en modo convención) se imprime con los valores base
  return [data ?? (error ? DEFAULTS : null), save];
}

export function SaleTicketView({ saleId }) {
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get('print') === '1';
  // ponytail: perilla de calibración; cada driver/cabezal trae unos mm de desfase propio
  const [settings, saveSettings] = useTicketPrintSettings();
  const { width, offset } = settings ?? DEFAULTS;
  const printed = useRef(false);

  const saleTicket = useSaleTicket(saleId);
  // El ticket espera al ajuste de la cuenta para no imprimir con el de fábrica
  const ticket = settings && (saleId ? saleTicket : SAMPLE_TICKET);

  const changeWidth = (_, value) => {
    if (!value) return;
    saveSettings({ width: value, offset });
  };

  const nudge = (delta) => {
    const next = Math.max(-8, Math.min(8, Math.round((offset + delta) * 10) / 10));
    saveSettings({ width, offset: next });
  };

  // Si la fuente web tarda (sin internet), se imprime con la de respaldo
  const handleReady = useCallback(() => {
    if (!autoPrint || printed.current) return;
    printed.current = true;
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(() =>
      window.print()
    );
  }, [autoPrint]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'grey.200',
        pb: 6,
        '@media print': { minHeight: 0, bgcolor: '#fff', p: 0 },
      }}
    >
      {/* La página mide justo lo imprimible: más ancha y el driver la recorre o la escala */}
      <style>{`@page { margin: 0; }
        @media print {
          html, body { width: ${PRINTABLE[width]}mm; margin: 0; padding: 0; background: #fff; }
          .od-ticket { margin: 0 !important; transform: translateX(${offset}mm); }
        }`}</style>

      <Stack
        direction="row"
        spacing={1.5}
        useFlexGap
        sx={{
          p: 2,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          '@media print': { display: 'none' },
        }}
      >
        <Button
          component={RouterLink}
          href={saleId ? paths.dashboard.sale.details(saleId) : paths.dashboard.sale.root}
          startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
        >
          {saleId ? 'Ver venta' : 'Ventas'}
        </Button>
        <ToggleButtonGroup size="small" exclusive value={width} onChange={changeWidth}>
          <ToggleButton value={58}>Rollo 58 mm</ToggleButton>
          <ToggleButton value={80}>Rollo 80 mm</ToggleButton>
        </ToggleButtonGroup>
        <Button
          variant="contained"
          disabled={!ticket}
          startIcon={<Iconify icon="solar:printer-minimalistic-bold" />}
          onClick={() => window.print()}
        >
          {saleId ? 'Imprimir ticket' : 'Imprimir prueba'}
        </Button>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Button size="small" variant="outlined" onClick={() => nudge(-0.1)}>
            ← 0.1 mm
          </Button>
          <Typography variant="body2" sx={{ minWidth: 92, textAlign: 'center' }}>
            Ajuste: {offset > 0 ? '+' : ''}
            {offset.toFixed(1)} mm
          </Typography>
          <Button size="small" variant="outlined" onClick={() => nudge(0.1)}>
            0.1 mm →
          </Button>
        </Stack>
        {saleId && (
          <Button
            component={RouterLink}
            href={paths.dashboard.sale.new}
            variant="outlined"
            startIcon={<Iconify icon="mingcute:add-line" />}
          >
            Nueva venta
          </Button>
        )}
      </Stack>

      {!saleId && (
        <Typography
          variant="body2"
          sx={{
            textAlign: 'center',
            color: 'text.secondary',
            mb: 2,
            px: 2,
            '@media print': { display: 'none' },
          }}
        >
          Ticket de ejemplo con datos ficticios para revisar la impresora: ancho, logo, QR y
          fuentes.
        </Typography>
      )}

      <Box
        sx={{
          width: 'fit-content',
          mx: 'auto',
          px: 2,
          bgcolor: '#fff',
          boxShadow: 3,
          '@media print': { boxShadow: 'none', p: 0, m: 0 },
        }}
      >
        {ticket ? (
          <SaleTicket ticket={ticket} width={width} onReady={handleReady} />
        ) : (
          <Box sx={{ p: 6 }}>
            <CircularProgress />
          </Box>
        )}
      </Box>
    </Box>
  );
}
