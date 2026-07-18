import QRCode from 'qrcode';
import { useState } from 'react';

import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { STATUS_LABELS } from './utils';

// ----------------------------------------------------------------------
// Etiquetas QR para los contenedores: el QR codifica el código del animal
// (= SKU del producto gemelo), así el modo escaneo del POS lo vende directo.
// La impresión abre una ventana con la hoja de etiquetas y el diálogo de
// imprimir del navegador — sin libs de PDF.
// ----------------------------------------------------------------------

const PRINT_STYLES = `
  body { margin: 0; font-family: Arial, sans-serif; }
  .sheet { display: grid; grid-template-columns: repeat(3, 1fr); }
  .label {
    border: 1px dashed #999; padding: 10px 6px; text-align: center;
    break-inside: avoid; page-break-inside: avoid;
  }
  .label img { width: 96px; height: 96px; }
  .code { font-family: 'Courier New', monospace; font-weight: bold; font-size: 13px; margin-top: 2px; }
  .common { font-size: 12px; font-weight: 600; margin-top: 2px; }
  .sci { font-size: 11px; font-style: italic; color: #444; }
`;

export function QrLabelsDialog({ species, animals, onClose }) {
  const scientific = [species.genus?.name, species.name].filter(Boolean).join(' ');
  const commonName = species.common_name ?? scientific;

  // Copias por etiqueta: para cepas el default es su stock (una por contenedor)
  const [copies, setCopies] = useState(() =>
    Object.fromEntries(animals.map((a) => [a.id, a.status === 'sold' ? 0 : Math.max(a.stock ?? 1, 1)]))
  );

  const total = animals.reduce((sum, a) => sum + (Number(copies[a.id]) || 0), 0);

  const handlePrint = async () => {
    const labels = [];
    for (const animal of animals) {
      const count = Number(copies[animal.id]) || 0;
      if (count <= 0) continue;
       
      const qr = await QRCode.toDataURL(animal.code, { width: 240, margin: 1 });
      for (let i = 0; i < count; i += 1) labels.push({ qr, code: animal.code });
    }

    if (!labels.length) return;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      toast.error('El navegador bloqueó la ventana de impresión');
      return;
    }

    printWindow.document.write(`<!doctype html>
<html><head><title>Etiquetas — ${commonName}</title><style>${PRINT_STYLES}</style></head>
<body><div class="sheet">${labels
      .map(
        (label) => `<div class="label">
          <img src="${label.qr}" alt="${label.code}" />
          <div class="code">${label.code}</div>
          <div class="common">${commonName}</div>
          <div class="sci">${scientific}</div>
        </div>`
      )
      .join('')}</div></body></html>`);
    printWindow.document.close();
    // data URLs cargan al instante; el respiro es para que pinte el layout
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <Dialog open fullWidth maxWidth="xs" onClose={onClose}>
      <DialogTitle>
        Etiquetas QR — {commonName}
        <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic', color: 'text.secondary' }}>
          {scientific}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right" sx={{ width: 96 }}>
                Copias
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {animals.map((animal) => (
              <TableRow key={animal.id}>
                <TableCell sx={{ fontFamily: 'monospace' }}>{animal.code}</TableCell>
                <TableCell>
                  {STATUS_LABELS[animal.status] ?? animal.status}
                  {(animal.stock ?? 1) > 1 ? ` · ${animal.stock} uds` : ''}
                </TableCell>
                <TableCell align="right">
                  <TextField
                    size="small"
                    type="number"
                    value={copies[animal.id]}
                    onChange={(e) =>
                      setCopies((prev) => ({ ...prev, [animal.id]: e.target.value }))
                    }
                    slotProps={{ htmlInput: { min: 0, style: { textAlign: 'right' } } }}
                    sx={{ width: 80 }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'text.secondary' }}>
          El QR lleva el código del animal: escanearlo en el POS lo agrega a la venta y descuenta
          stock. Hoja carta, 3 etiquetas por fila, recortables.
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cerrar
        </Button>
        <Button
          variant="contained"
          disabled={!total}
          startIcon={<Iconify icon="solar:printer-minimalistic-bold" />}
          onClick={handlePrint}
        >
          Imprimir {total} etiqueta{total === 1 ? '' : 's'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
