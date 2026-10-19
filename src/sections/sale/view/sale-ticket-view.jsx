import { useRef, useState, useCallback } from 'react';

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

import { Iconify } from 'src/components/iconify';

import { SaleTicket } from '../sale-ticket';
import { SAMPLE_TICKET, useSaleTicket } from '../print-ticket';

// ----------------------------------------------------------------------
// Vista imprimible del ticket, fuera del layout del dashboard para que solo
// salga el ticket en el rollo. ?print=1 (viene del POS) imprime al cargar.
// Sin saleId imprime el ticket de prueba.
// ----------------------------------------------------------------------

const WIDTH_KEY = 'ticketWidth';
const OFFSET_KEY = 'ticketOffset';
// Área imprimible de cada rollo (lo mismo que .od-ticket en sale-ticket.jsx)
const PRINTABLE = { 58: 48, 80: 72 };

const read = (key) => {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};
const save = (key, value) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* sin almacenamiento: solo dura esta visita */
  }
};

export function SaleTicketView({ saleId }) {
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get('print') === '1';
  const [width, setWidth] = useState(() => (read(WIDTH_KEY) === 58 ? 58 : 80));
  // ponytail: perilla de calibración; cada driver/cabezal trae unos mm de desfase propio
  const [offset, setOffset] = useState(() => read(OFFSET_KEY));
  const printed = useRef(false);

  const saleTicket = useSaleTicket(saleId);
  const ticket = saleId ? saleTicket : SAMPLE_TICKET;

  const changeWidth = (_, value) => {
    if (!value) return;
    setWidth(value);
    save(WIDTH_KEY, value);
  };

  const nudge = (delta) => {
    const next = Math.max(-8, Math.min(8, Math.round((offset + delta) * 10) / 10));
    setOffset(next);
    save(OFFSET_KEY, next);
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
