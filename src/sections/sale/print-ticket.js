import { CONFIG } from 'src/global-config';

// ----------------------------------------------------------------------
// Ticket de venta para impresora térmica (58/80mm). Imprime vía iframe
// oculto: no depende de popups y hereda la impresora del navegador.
// items: [{ title, quantity, unitPrice, discount }]
// payments: [{ method_payment, amount }]
// ----------------------------------------------------------------------

const PAYMENT_LABELS = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

const money = (n) => `$${Number(n ?? 0).toFixed(2)}`;

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const computeTotals = (items, payments) => {
  const total = items.reduce(
    (acc, it) => acc + it.quantity * it.unitPrice - Number(it.discount ?? 0),
    0
  );
  const paid = payments.reduce((acc, p) => acc + Number(p.amount ?? 0), 0);
  return { total, change: paid - total };
};

// Ticket en texto plano para compartir por WhatsApp o correo
export function buildTicketText({ saleId, date, items, payments }) {
  const { total, change } = computeTotals(items, payments);
  const lines = [
    `*${CONFIG.appName}*`,
    `Ticket de venta #${saleId}`,
    new Date(date ?? Date.now()).toLocaleString('es-MX'),
    '--------------------',
    ...items.map((it) => {
      const sub = it.quantity * it.unitPrice - Number(it.discount ?? 0);
      const desc = Number(it.discount) ? ` (desc ${money(it.discount)})` : '';
      return `${it.quantity} x ${it.title}${desc} — ${money(sub)}`;
    }),
    '--------------------',
    `*TOTAL: ${money(total)}*`,
    ...payments.map(
      (p) => `${PAYMENT_LABELS[p.method_payment] ?? p.method_payment}: ${money(p.amount)}`
    ),
    ...(change > 0.009 ? [`Cambio: ${money(change)}`] : []),
    '',
    '¡Gracias por su compra!',
  ];
  return lines.join('\n');
}

// wa.me sin número abre el selector de contactos del vendedor
export const ticketWhatsAppUrl = (ticket) =>
  `https://wa.me/?text=${encodeURIComponent(ticket.replace(/—/g, '-'))}`;

export const ticketMailtoUrl = (ticket, saleId) =>
  `mailto:?subject=${encodeURIComponent(`Ticket de venta #${saleId} - ${CONFIG.appName}`)}&body=${encodeURIComponent(ticket.replace(/\*/g, ''))}`;

export function printTicket({ saleId, date, items, payments }) {
  const { total, change } = computeTotals(items, payments);

  const itemRows = items
    .map((it) => {
      const sub = it.quantity * it.unitPrice - Number(it.discount ?? 0);
      return `<div class="item">${esc(it.title)}</div>
        <div class="row"><span>${it.quantity} x ${money(it.unitPrice)}${
          Number(it.discount) ? ` (desc ${money(it.discount)})` : ''
        }</span><span>${money(sub)}</span></div>`;
    })
    .join('');

  const paymentRows = payments
    .map(
      (p) =>
        `<div class="row"><span>${esc(PAYMENT_LABELS[p.method_payment] ?? p.method_payment)}</span><span>${money(p.amount)}</span></div>`
    )
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ticket #${saleId}</title><style>
    @page { margin: 0; }
    body { width: 58mm; margin: 0; padding: 2mm 3mm; font: 12px/1.5 'Courier New', monospace; color: #000; }
    .center { text-align: center; }
    .row { display: flex; justify-content: space-between; gap: 4px; }
    .item { word-break: break-word; }
    .total { font-weight: bold; font-size: 14px; }
    hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
  </style></head><body>
    <div class="center" style="font-weight:bold">${esc(CONFIG.appName)}</div>
    <div class="center">Venta #${saleId}</div>
    <div class="center">${new Date(date ?? Date.now()).toLocaleString('es-MX')}</div>
    <hr/>
    ${itemRows}
    <hr/>
    <div class="row total"><span>TOTAL</span><span>${money(total)}</span></div>
    ${paymentRows}
    ${change > 0.009 ? `<div class="row"><span>Cambio</span><span>${money(change)}</span></div>` : ''}
    <hr/>
    <div class="center">¡Gracias por su compra!</div>
  </body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
  // ponytail: limpiar tarde; quitarlo de inmediato cancela la impresión en algunos navegadores
  setTimeout(() => iframe.remove(), 60000);
}
