import '@fontsource/playfair-display/400-italic.css';

import QRCode from 'qrcode';
import { useState, useEffect } from 'react';

import { folio, money, qrLabel, fmtTicketDate, ticketSubtotal } from './print-ticket';

// ----------------------------------------------------------------------
// Ticket térmico (Opuntia_Den_Marca/8_Ticket/Ticket_ejemplo_80mm.pdf). Solo
// negro sobre blanco: la térmica no imprime grises ni colores.
// ----------------------------------------------------------------------

const CSS = `
.od-ticket { width: 72mm; margin: 0 auto; padding: 4mm 0; background: #fff;
  font: 8pt/1.4 'Inter Variable', Inter, Arial, sans-serif; }
.od-ticket--58 { width: 48mm; font-size: 7.5pt; }
.od-ticket * { color: #000 !important; background: transparent !important; box-shadow: none !important; }
.od-ticket .c { text-align: center; }
.od-ticket .logo { display: block; width: 35mm; margin: 0 auto 2.5mm; }
.od-ticket--58 .logo { width: 30mm; }
.od-ticket .brand { font-weight: 700; font-size: 11pt; letter-spacing: 0.02em; }
.od-ticket hr { border: 0; border-top: 1px dashed #000; margin: 2.5mm 0; }
.od-ticket .row { display: flex; justify-content: space-between; gap: 2mm; }
.od-ticket .row > :last-child { text-align: right; }
.od-ticket .b { font-weight: 700; }
.od-ticket .th { font-size: 0.82em; font-weight: 700; }
.od-ticket .item { display: grid; grid-template-columns: 8mm 1fr auto; column-gap: 1.5mm; margin-top: 1.5mm; }
.od-ticket--58 .item { grid-template-columns: 6.5mm 1fr auto; }
.od-ticket .sci, .od-ticket .serif { font-family: 'Playfair Display', Georgia, serif; font-style: italic; }
.od-ticket .sci { font-size: 1.15em; }
.od-ticket .sub { font-size: 0.92em; }
.od-ticket .total { font-size: 11pt; font-weight: 700; margin: 1.5mm 0; }
.od-ticket--58 .total { font-size: 10pt; }
.od-ticket .thanks { font-size: 13pt; }
.od-ticket .qr { display: block; width: 26mm; margin: 1.5mm auto; }
.od-ticket--58 .qr { width: 24mm; }
.od-ticket .qr svg { display: block; width: 100%; height: auto; }
.od-ticket .small { font-size: 0.88em; }
`;

function Row({ label, value, bold }) {
  return (
    <div className={`row${bold ? ' b' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// business: «Datos del negocio» (useTicketTemplate). Sin logo o sin URL del
// QR, esa parte no se imprime.
export function SaleTicket({ ticket, business = {}, width = 80, onReady }) {
  const b = business;
  const qrUrl = b.ticket_qr_url;
  const [qr, setQr] = useState('');
  const [logoDone, setLogoDone] = useState(false);

  useEffect(() => {
    if (qrUrl) QRCode.toString(qrUrl, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 }).then(setQr);
  }, [qrUrl]);

  const ready = (!qrUrl || qr) && (!b.ticket_logo_url || logoDone);
  useEffect(() => {
    if (ready) onReady?.();
  }, [ready, onReady]);

  const t = ticket;
  const subtotal = ticketSubtotal(t);
  const change = (t.pagado ?? 0) - t.total;

  return (
    <div className={`od-ticket${width === 58 ? ' od-ticket--58' : ''}`}>
      <style>{CSS}</style>

      {b.ticket_logo_url && (
        <img
          className="logo"
          src={b.ticket_logo_url}
          alt={b.business_name ?? ''}
          onLoad={() => setLogoDone(true)}
          onError={() => setLogoDone(true)}
        />
      )}
      <div className="c">
        {b.business_name && <div className="brand">{b.business_name.toUpperCase()}</div>}
        {b.tagline && <div>{b.tagline}</div>}
        {(b.website || b.instagram) && (
          <div>{[b.website, b.instagram].filter(Boolean).join(' · ')}</div>
        )}
        {b.phone && <div>Tel. {b.phone}</div>}
      </div>

      <hr />
      <Row label="Folio" value={folio(t.id, b.folio_prefix)} bold />
      <Row label="Fecha" value={fmtTicketDate(t.fecha)} />
      {t.cliente && <Row label="Cliente" value={t.cliente} />}
      {t.entrega && (
        <Row
          label="Entrega"
          value={[t.entrega.metodo, t.entrega.fecha].filter(Boolean).join(' · ')}
        />
      )}

      <hr />
      <div className="item th" style={{ marginTop: 0 }}>
        <span>CANT</span>
        <span>DESCRIPCIÓN</span>
        <span>IMPORTE</span>
      </div>
      {t.items.map((it, i) => (
        <div className="item" key={i}>
          <span>{it.cantidad}</span>
          <div>
            <div className={it.es_cientifico ? 'sci' : undefined}>{it.nombre}</div>
            {it.detalle && <div className="sub">{it.detalle}</div>}
            <div className="sub">
              {it.cantidad} × {money(it.precio_unitario)}
            </div>
          </div>
          <span>{money(it.cantidad * it.precio_unitario)}</span>
        </div>
      ))}

      <hr />
      <Row label="Subtotal" value={money(subtotal)} />
      {t.envio ? <Row label="Envío" value={money(t.envio)} /> : null}
      {t.descuento ? <Row label="Descuento" value={`−${money(t.descuento)}`} /> : null}
      {t.impuestos ? <Row label="Impuestos" value={money(t.impuestos)} /> : null}
      <div className="row total">
        <span>TOTAL</span>
        <span>{money(t.total)} MXN</span>
      </div>
      {t.metodo_pago && <Row label="Pago" value={t.metodo_pago} />}
      {t.pagado ? <Row label="Pagado" value={money(t.pagado)} /> : null}
      {change > 0.009 && <Row label="Cambio" value={money(change)} />}

      <hr />
      <div className="c">
        <div className="serif thanks">Gracias por tu compra</div>
        {qrUrl && (
          <>
            <div>Escanea para ver la guía de cuidados</div>
            {/* SVG generado localmente por qrcode (sin datos del usuario) */}
            <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
            <div>{qrLabel(qrUrl)}</div>
          </>
        )}
        <div className="small" style={{ marginTop: '1.5mm' }}>
          Este ticket no es un comprobante fiscal.
        </div>
        {t.sample && (
          <div className="small b" style={{ marginTop: '1.5mm' }}>
            — PRUEBA · DATOS FICTICIOS —
          </div>
        )}
      </div>
    </div>
  );
}
