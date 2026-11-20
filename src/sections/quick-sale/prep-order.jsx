import { TICKET_WIDTH } from 'src/sections/sale/sale-ticket';
import { fmtTicketDate } from 'src/sections/sale/print-ticket';

// ----------------------------------------------------------------------
// Talón de orden: lo que se prepara al momento (slushies, etc.). Va en su
// propia página para que una impresora con cortador lo separe del ticket del
// cliente (driver en «cortar por página»). Sin precios: es para quien prepara.
// ----------------------------------------------------------------------

const CSS = `
.od-ticket.od-order { width: ${TICKET_WIDTH[80]}mm; margin: 0 auto; padding: 4mm 0; background: #fff; color: #000;
  font: 700 15pt/1.3 'Inter Variable', Inter, Arial, sans-serif; }
.od-ticket--58.od-order { width: ${TICKET_WIDTH[58]}mm; font-size: 12pt; }
.od-order--after { break-before: page; border-top: 1px dashed #000; }
.od-order .title { text-align: center; font-size: 1.3em; letter-spacing: 0.12em; }
.od-order .meta { display: flex; justify-content: space-between; gap: 2mm; font-size: 0.6em; font-weight: 400; }
.od-order hr { border: 0; border-top: 1px dashed #000; margin: 2.5mm 0; }
.od-order .line { margin-top: 1.5mm; }
.od-order .sample { justify-content: center; margin-top: 3mm; font-weight: 700; }
@media print { .od-order--after { border-top: 0; } }
`;

// Para «Imprimir prueba»: así sale la orden y así corta la impresora
export const SAMPLE_ORDER = {
  folio: 'VR-PRUEBA-0001',
  sold_at: new Date().toISOString(),
  sample: true,
  lines: [
    { product_id: 'a', quantity: 3, title: 'Slushie limón $100', needs_prep: true },
    { product_id: 'b', quantity: 2, title: 'Slushie mango $50', needs_prep: true },
  ],
};

export const prepLines = (sale) => (sale?.lines ?? []).filter((line) => line.needs_prep);

// after: va después del ticket del cliente (empieza página nueva)
export function PrepOrder({ sale, width = 80, after = false }) {
  const lines = prepLines(sale);
  if (!lines.length) return null;

  return (
    <div
      data-testid="prep-order"
      className={`od-ticket od-order${width === 58 ? ' od-ticket--58' : ''}${after ? ' od-order--after' : ''}`}
    >
      <style>{CSS}</style>
      <div className="title">ORDEN</div>
      <div className="meta">
        <span>{sale.folio}</span>
        <span>{fmtTicketDate(sale.sold_at)}</span>
      </div>
      <hr />
      {lines.map((line) => (
        <div className="line" key={line.product_id}>
          {line.quantity} × {line.title}
        </div>
      ))}
      {sale.sample && <div className="meta sample">— PRUEBA · DATOS FICTICIOS —</div>}
    </div>
  );
}
