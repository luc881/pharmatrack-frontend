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
import { PrepOrder, SAMPLE_ORDER } from '../../quick-sale/prep-order';
import { SAMPLE_TICKET, useSaleTicket, useTicketTemplate } from '../print-ticket';

// ----------------------------------------------------------------------
// Vista imprimible del ticket, fuera del layout del dashboard para que solo
// salga el ticket en el rollo. ?print=1 (viene del POS) imprime al cargar.
// Sin saleId imprime el ticket de prueba.
// ----------------------------------------------------------------------

// Área imprimible de cada rollo (lo mismo que .od-ticket en sale-ticket.jsx)
const PRINTABLE = { 58: 48, 80: 72 };
const PAPER = { 58: 58, 80: 80 };
const SETTINGS_URL = '/api/v1/settings/ticket-print';
const DEFAULTS = { width: 80, offset: 0, scale: null };
// Tamaño del contenido si no se ha elegido: en 80 mm, 5 % más chico para que
// quede margen (el cabezal imprime pálido en la orilla)
const DEFAULT_SCALE = { 58: 100, 80: 95 };
export const scaleOf = ({ width, scale }) => scale ?? DEFAULT_SCALE[width];

// Antes el ajuste vivía en el navegador; se lee solo para subirlo a la cuenta
const readLocal = (key) => {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};

// Rollo y ajuste horizontal guardados en la cuenta (API /settings/ticket-print)
// fallback: lo que se usa sin API (sin internet, la copia guardada en el equipo).
// enabled=false no pide nada a la red (el ticket de la venta rápida).
export function useTicketPrintSettings({ fallback = DEFAULTS, enabled = true } = {}) {
  const { data, error, mutate } = useSWR(enabled ? SETTINGS_URL : null, fetcher, {
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
  return [data ?? (error ? fallback : null), save];
}

// Rollo, ajuste horizontal y ancho: los mismos controles en Ventas y en la
// venta rápida. onChange recibe la configuración completa.
export function TicketPrintControls({ settings, onChange }) {
  const { width, offset } = settings;
  const scale = scaleOf(settings);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, Math.round(v * 10) / 10));
  const nudge = (delta) => onChange({ ...settings, offset: clamp(offset + delta, -8, 8) });
  const resize = (delta) => onChange({ ...settings, scale: clamp(scale + delta, 50, 100) });

  return (
    <>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={width}
        onChange={(_, value) => value && onChange({ ...settings, width: value })}
      >
        <ToggleButton value={58}>Rollo 58 mm</ToggleButton>
        <ToggleButton value={80}>Rollo 80 mm</ToggleButton>
      </ToggleButtonGroup>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <Button size="small" variant="outlined" onClick={() => nudge(-1)}>
          ← 1 mm
        </Button>
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
        <Button size="small" variant="outlined" onClick={() => nudge(1)}>
          1 mm →
        </Button>
      </Stack>
      {/* Todo el contenido (letra, logo, QR) más chico: el papel queda igual
          y crecen los márgenes */}
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <Button size="small" variant="outlined" disabled={scale <= 50} onClick={() => resize(-1)}>
          Más chico
        </Button>
        <Typography variant="body2" sx={{ minWidth: 92, textAlign: 'center' }}>
          Tamaño: {scale} %
        </Typography>
        <Button size="small" variant="outlined" disabled={scale >= 100} onClick={() => resize(1)}>
          Más grande
        </Button>
      </Stack>
    </>
  );
}

export function SaleTicketView({ saleId }) {
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get('print') === '1';
  // ponytail: perilla de calibración; cada driver/cabezal trae unos mm de desfase propio
  const [settings, saveSettings] = useTicketPrintSettings();
  const { width, offset } = settings ?? DEFAULTS;
  const scale = scaleOf(settings ?? DEFAULTS);
  const saleTicket = useSaleTicket(saleId);
  const business = useTicketTemplate();
  // El ticket espera al ajuste de la cuenta (para no imprimir con el de
  // fábrica) y a los datos del negocio
  const ticket = settings && business && (saleId ? saleTicket : SAMPLE_TICKET);

  return (
    <TicketPrintPage
      // La prueba trae también un talón de orden (lo que se prepara al
      // momento en la venta rápida): sirve para ver cómo sale y si la
      // impresora corta entre el ticket y la orden
      extra={!saleId && ticket ? <PrepOrder sale={SAMPLE_ORDER} width={width} after /> : null}
      ticket={ticket}
      business={business}
      width={width}
      offset={offset}
      scale={scale}
      autoPrint={autoPrint}
      controls={
        <>
          <Button
            component={RouterLink}
            href={saleId ? paths.dashboard.sale.details(saleId) : paths.dashboard.sale.root}
            startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
          >
            {saleId ? 'Ver venta' : 'Ventas'}
          </Button>
          <Button
            variant="contained"
            disabled={!ticket}
            startIcon={<Iconify icon="solar:printer-minimalistic-bold" />}
            onClick={() => window.print()}
          >
            {saleId ? 'Imprimir ticket' : 'Imprimir prueba'}
          </Button>
          <TicketPrintControls settings={settings ?? DEFAULTS} onChange={saveSettings} />
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
        </>
      }
      hint={
        !saleId && (
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
        )
      }
    />
  );
}

// ----------------------------------------------------------------------

// La hoja imprimible: controles arriba (no salen en el rollo) y el ticket.
// La usan el ticket de una venta guardada y el de la venta rápida, que se
// arma con los datos del dispositivo.
// extra: lo que se imprime después del ticket (el talón de orden de la venta
// rápida); hideTicket: solo eso. tickets: varios tickets seguidos (venta
// rápida con productos de más de un dueño), [{ ticket, business }]; se
// imprime cuando todos tienen listo su logo y su QR.
export function TicketPrintPage({
  ticket,
  tickets,
  business,
  width,
  offset,
  scale = 100,
  autoPrint,
  controls,
  hint,
  extra,
  hideTicket = false,
}) {
  const printed = useRef(false);
  const list = tickets ?? (ticket ? [{ ticket, business }] : null);
  const readyCount = useRef(new Set());

  // Si la fuente web tarda (sin internet), se imprime con la de respaldo
  const handleReady = useCallback(() => {
    if (!autoPrint || printed.current) return;
    printed.current = true;
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(() =>
      window.print()
    );
  }, [autoPrint]);

  // Sin ticket no hay quien avise que ya se puede imprimir
  useEffect(() => {
    if (hideTicket) handleReady();
  }, [hideTicket, handleReady]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'grey.200',
        pb: 6,
        '@media print': { minHeight: 0, bgcolor: '#fff', p: 0 },
      }}
    >
      {/* La página mide justo lo imprimible: más ancha y el driver la recorre o la escala.
          El contenido va a scale % (zoom: letra, logo y QR), centrado: el resto es margen */}
      <style>{`@page { margin: 0; }
        .od-ticket { zoom: ${scale / 100}; margin: 0 auto !important; }
        @media print {
          html, body { width: ${PRINTABLE[width]}mm; margin: 0; padding: 0; background: #fff; }
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
        {controls}
      </Stack>

      {hint}

      {/* En pantalla, el rollo completo para ver los márgenes; al imprimir, lo
          imprimible, corrido por el ajuste horizontal (left: no parte las páginas) */}
      <Box
        sx={{
          width: `${PAPER[width]}mm`,
          mx: 'auto',
          bgcolor: '#fff',
          boxShadow: 3,
          '@media print': {
            width: `${PRINTABLE[width]}mm`,
            boxShadow: 'none',
            p: 0,
            m: 0,
            position: 'relative',
            left: `${offset}mm`,
          },
        }}
      >
        {!hideTicket &&
          (list ? (
            list.map((t, i) => (
              <SaleTicket
                key={t.ticket.folio ?? i}
                ticket={t.ticket}
                business={t.business}
                width={width}
                onReady={() => {
                  readyCount.current.add(i);
                  if (readyCount.current.size === list.length) handleReady();
                }}
              />
            ))
          ) : (
            <Box sx={{ p: 6 }}>
              <CircularProgress />
            </Box>
          ))}
        {extra}
      </Box>
    </Box>
  );
}
