import { discountPercent } from 'src/utils/discount';

import { purposeOf, saleFormatLabel } from './utils';

// ----------------------------------------------------------------------
// Lista de precios imprimible para la mesa de una convención: una fila por
// especie y variedad (sin anidar), solo lo disponible en venta, con el precio
// original y el % cuando hay descuento.

const money = (n) => `$${Number(n).toLocaleString()}`;
const range = (values) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? money(min) : `${money(min)} – ${money(max)}`;
};

const forSale = (a) => {
  const bulk = a.species?.sale_format && a.species.sale_format !== 'individual';
  return (
    a.status === 'available' && purposeOf(a) === 'sale' && !(bulk && Number(a.stock) === 0)
  );
};

const varietyOf = (a) =>
  (a.morphs ?? []).length
    ? a.morphs
        .map((m) => m.name)
        .sort()
        .join(' ')
    : null;

export function priceListRows(grouped) {
  return grouped.flatMap(({ species, animals }) => {
    const sci = [species.genus?.name, species.name].filter(Boolean).join(' ');
    const byVariety = new Map();
    animals.filter(forSale).forEach((a) => {
      const key = varietyOf(a);
      if (!byVariety.has(key)) byVariety.set(key, []);
      byVariety.get(key).push(a);
    });
    const tiers = species.price_tiers ?? [];

    return [...byVariety]
      .sort(([x], [y]) => (x === null ? -1 : y === null ? 1 : x.localeCompare(y)))
      .map(([variety, list]) => {
        const discounted = list
          .map((a) => discountPercent(a.price, a.compare_at_price))
          .filter(Boolean);
        const sameForAll = discounted.length === list.length && new Set(discounted).size === 1;
        const showDiscount = !tiers.length && discounted.length > 0;
        return {
          name: species.common_name ?? sci,
          scientific: sci,
          variety,
          format: saleFormatLabel(species) ?? 'Individual',
          units: list.reduce((sum, a) => sum + Number(a.stock ?? 1), 0),
          // precios por cantidad de la especie: se muestran tal cual, sin descuento
          price: tiers.length
            ? tiers.map((t) => `${t.quantity} × ${money(t.price)}`).join('  ·  ')
            : range(list.map((a) => Number(a.price))),
          original: showDiscount
            ? range(list.map((a) => Math.max(Number(a.price), Number(a.compare_at_price ?? 0))))
            : null,
          discount: showDiscount
            ? `${sameForAll ? '' : 'hasta '}−${Math.max(...discounted)}%`
            : null,
        };
      });
  });
}

// Una sección por vendedor (lo mío primero, luego cada proveedor por nombre),
// solo con lo que tiene disponible. key: 'mine' o el id del proveedor.
export function priceListSections(grouped, { mine, suppliers = [] }) {
  const owners = [
    { key: 'mine', title: mine, test: (a) => !a.consignor_id },
    ...[...suppliers]
      .sort((x, y) => x.name.localeCompare(y.name))
      .map((s) => ({ key: String(s.id), title: s.name, test: (a) => a.consignor_id === s.id })),
  ];
  return owners
    .map(({ key, title, test }) => ({
      key,
      title,
      rows: priceListRows(
        grouped.map((entry) => ({ ...entry, animals: entry.animals.filter(test) }))
      ),
    }))
    .filter((section) => section.rows.length);
}

const ESCAPES ={ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ESCAPES[c]);

// sections: [{ title, rows }] de priceListSections; cada vendedor en su hoja
export function printPriceList(sections) {
  const renderRows = (rows) =>
    rows
    .map(
      (r) => `<tr>
        <td><strong>${escape(r.name)}</strong>${r.variety ? ` <span class="variety">${escape(r.variety)}</span>` : ''}<br/><em>${escape(r.scientific)}</em></td>
        <td>${escape(r.format)}</td>
        <td>${r.units}</td>
        <td>${
          r.original
            ? `<s>${r.original}</s><br/><strong>${r.price}</strong> <span class="off">${r.discount}</span>`
            : r.price
        }</td>
      </tr>`
    )
    .join('');
  const date = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const body = sections
    .map(
      (section) => `<section>
    <h1>Lista de precios${section.title ? ` · ${escape(section.title)}` : ''}</h1>
    <p>${date} — solo disponibles</p>
    <table><thead><tr><th>Especie y variedad</th><th>Formato</th><th>Disp.</th><th>Precio</th></tr></thead>
    <tbody>${renderRows(section.rows)}</tbody></table>
  </section>`
    )
    .join('');

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>Lista de precios</title><style>
    body { font-family: Arial, sans-serif; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    p { color: #666; font-size: 12px; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px 10px; border-bottom: 1px solid #ddd; text-align: left; vertical-align: top; }
    th { background: #f4f6f8; text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; }
    em { color: #666; font-size: 11px; }
    .variety { font-weight: 600; color: #444; }
    s { color: #888; }
    .off { font-weight: 700; color: #c62828; }
    tr { break-inside: avoid; }
    section + section { break-before: page; }
  </style></head><body>${body || '<p>No hay nada disponible.</p>'}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 300);
}
