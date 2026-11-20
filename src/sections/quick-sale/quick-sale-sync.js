import { fCurrency } from 'src/utils/format-number';

import axiosInstance, { endpoints } from 'src/lib/axios';

import { toItem, BUSINESS_URL } from 'src/sections/sale/print-ticket';

import { refreshSession } from 'src/auth/context/jwt/utils';

import { priced, cartTotals, namedSplit, ownerSplit } from './quick-sale-math';
import {
  getKV,
  setKV,
  addSale,
  putSale,
  listSales,
  nextFolio,
  deleteSale,
} from './quick-sale-store';

// ----------------------------------------------------------------------
// Ventas del dispositivo: se arman completas al cobrar (con lo necesario
// para imprimir el ticket y para subirlas después) y viven en la cola local
// hasta que el servidor las registra.
// ----------------------------------------------------------------------

// Renglón del ticket con los mismos nombres que el ticket de una venta
// guardada (nombre científico si el producto es el gemelo de un animal)
export const buildTicketItem = (item, quantity, discount = 0) =>
  toItem(
    { product_id: item.id, quantity, price_unit: item.price_retail, discount },
    { title: item.title },
    item.animal
  );

export function buildLocalSale({
  key,
  folio,
  soldAt,
  branchId,
  method,
  cart,
  itemsById,
  suppliers = [],
  ownerFolios = {},
}) {
  const totals = cartTotals(cart, itemsById);
  // Venta mezclada (productos de más de un dueño): cuánto es de cada quien
  const owners = namedSplit(cart, itemsById, suppliers);
  const ownerOf = (line) => itemsById.get(line.product_id)?.consignor_id ?? null;
  // Con algo de un proveedor: un ticket por dueño (lo propio primero), cada
  // uno con su folio y su total. Solo lo propio: un ticket, como siempre.
  const tickets = cart.some((line) => ownerOf(line) !== null)
    ? ownerSplit(cart, itemsById).map(({ consignor_id }) => ({
        consignor_id,
        folio: consignor_id === null ? folio : (ownerFolios[consignor_id] ?? folio),
        totals: cartTotals(
          cart.filter((line) => ownerOf(line) === consignor_id),
          itemsById
        ),
      }))
    : null;
  return {
    ...(owners.length > 1 ? { owners } : {}),
    ...(tickets ? { tickets } : {}),
    idempotency_key: key,
    folio,
    sold_at: soldAt,
    branch_id: branchId,
    status: 'pending',
    lines: cart.map((line) => {
      // con el precio de la línea (el que puso un admin al cobrar, si hubo)
      const item = priced(itemsById.get(line.product_id), line);
      return {
        product_id: line.product_id,
        consignor_id: item.consignor_id ?? null,
        title: item.title,
        quantity: line.quantity,
        discount: line.discount,
        price_retail: item.price_retail,
        ...(line.unit_price !== undefined && line.unit_price !== null
          ? { unit_price: line.unit_price }
          : {}),
        tax_percentage: item.tax_percentage ?? null,
        // para el talón de orden
        needs_prep: Boolean(item.needs_prep),
        // para apartar el stock de los componentes mientras no se suba
        components: item.components.map(({ product_id, quantity }) => ({ product_id, quantity })),
        ticketItem: buildTicketItem(item, line.quantity, line.discount),
      };
    }),
    payment: { method_payment: method, amount: totals.total },
    totals,
  };
}

// ----------------------------------------------------------------------
// Productos de último momento: se crean en el equipo (sin red) y se dan de
// alta en el sistema al subir su primera venta. En este equipo su id es
// siempre `local:<client_key>`; al subir se cambia por el id real.
// ----------------------------------------------------------------------

const LOCAL = 'local:';
export const localId = (clientKey) => `${LOCAL}${clientKey}`;
const isLocal = (productId) => String(productId).startsWith(LOCAL);

const getProvisionals = async () => (await getKV('provisionals')) ?? [];

export async function addProvisional({
  title,
  price_retail,
  needs_prep = false,
  consignor_id = null,
}) {
  const provisional = {
    client_key: crypto.randomUUID(),
    title,
    price_retail,
    needs_prep,
    consignor_id,
  };
  await setKV('provisionals', [...(await getProvisionals()), provisional]);
  return provisional;
}

// Con la misma forma que un producto del catálogo de la venta rápida
export const provisionalItem = (p) => ({
  id: localId(p.client_key),
  title: p.title,
  image: null,
  category: 'De último momento',
  price_retail: p.price_retail,
  tax_percentage: null,
  max_discount: null,
  stock: null,
  is_bundle: false,
  components: [],
  blocked_reason: null,
  animal: null,
  needs_prep: p.needs_prep,
  provisional: true,
  client_key: p.client_key,
  consignor_id: p.consignor_id,
});

const usedLocally = (sales, clientKey) =>
  sales.some((s) => s.lines.some((line) => line.product_id === localId(clientKey)));

// Solo se quita lo que nunca se vendió ni se subió (un error de dedo)
export async function removeProvisional(clientKey) {
  const [list, sales] = await Promise.all([getProvisionals(), listSales()]);
  const target = list.find((p) => p.client_key === clientKey);
  if (!target || target.server_id || usedLocally(sales, clientKey)) return false;
  await setKV(
    'provisionals',
    list.filter((p) => p !== target)
  );
  return true;
}

// Id del sistema para una línea `local:`; lo da de alta si aún no existe.
// La misma client_key en cada intento: repetir no lo duplica. Los errores
// salen con su status para que `upload` los trate igual que los de la venta.
async function serverIdOf(productId) {
  const clientKey = productId.slice(LOCAL.length);
  const list = await getProvisionals();
  const target = list.find((p) => p.client_key === clientKey);
  if (!target) {
    throw Object.assign(new Error('Un producto nuevo de esta venta ya no está en este equipo'), {
      status: 400,
    });
  }
  if (target.server_id) return target.server_id;
  try {
    const { data } = await axiosInstance.post(endpoints.product.provisional, {
      client_key: target.client_key,
      title: target.title,
      price_retail: target.price_retail,
      needs_prep: target.needs_prep,
      consignor_id: target.consignor_id,
    });
    await setKV(
      'provisionals',
      (await getProvisionals()).map((p) =>
        p.client_key === clientKey ? { ...p, server_id: data.id } : p
      )
    );
    return data.id;
  } catch (error) {
    throw Object.assign(new Error(`No se pudo dar de alta «${target.title}»: ${error.message}`), {
      status: error.status,
    });
  }
}

// ----------------------------------------------------------------------
// Preparar: bajar al dispositivo todo lo que hace falta para vender sin red
// ----------------------------------------------------------------------

const TICKET_SETTINGS_URL = '/api/v1/settings/ticket-print';
const KEEP_SYNCED_MS = 7 * 24 * 60 * 60 * 1000;

const optional = (url) =>
  axiosInstance
    .get(url)
    .then((res) => res.data)
    .catch(() => null);

const SHELL_WAIT_MS = 60_000;
// El mismo nombre que en vite.config.js (runtimeCaching)
const IMAGE_CACHE = 'quick-sale-images';

// ¿Ya terminó el service worker de guardar la app en el equipo? Hasta
// entonces no abriría sin red ni guardaría las fotos. En desarrollo y en
// navegadores sin service worker no hay nada que esperar.
export function shellReady() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return Promise.resolve(true);
  return Promise.race([
    navigator.serviceWorker.ready.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), SHELL_WAIT_MS)),
  ]);
}

export async function prepareOffline({ branchId, user }) {
  // La hora en que se PIDE el catálogo: lo que se suba después de este
  // momento no viene restado en él (ver usage en quick-sale-math.js)
  const requestedAt = new Date().toISOString();
  // Si el catálogo no baja, se lanza el error sin tocar lo ya guardado
  const [catalog, business, ticketSettings, suppliers, previous] = await Promise.all([
    axiosInstance.get(endpoints.product.quickSale).then((res) => res.data),
    optional(BUSINESS_URL),
    optional(TICKET_SETTINGS_URL),
    // los dueños posibles de un producto nuevo («De quién es»)
    optional(`${endpoints.supplier.list}?page_size=100`),
    getKV('context'),
  ]);

  const fetchedAt = new Date().toISOString();
  // Dos descargas a la vez: gana la que se pidió más tarde, no la que
  // termina al último
  const current = await getKV('catalog');
  if (!(current?.requestedAt > requestedAt)) {
    await setKV('catalog', { items: catalog, fetchedAt, requestedAt });
  }
  await setKV('context', {
    business: business ?? previous?.business ?? {},
    ticketSettings: ticketSettings ?? previous?.ticketSettings ?? null,
    // al abrir la pantalla la sucursal puede no haber cargado todavía
    branchId: branchId ?? previous?.branchId ?? null,
    user: user ?? previous?.user ?? null,
    suppliers:
      // con lo necesario para imprimir su ticket sin internet
      suppliers?.data
        ?.filter((s) => s.is_active !== false)
        .map(({ id, name, logo, ticket_prefix, ticket_lines, ticket_qr_url }) => ({
          id,
          name,
          logo,
          ticket_prefix,
          ticket_lines,
          ticket_qr_url,
        })) ??
      previous?.suppliers ??
      [],
  });

  // Las fotos (y el logo del ticket) van a un caché propio, que el service
  // worker solo lee: lo demás que se ve en el dashboard ni se guarda ni las saca
  const images = [
    ...catalog.map((item) => item.image),
    business?.ticket_logo_url,
    ...(suppliers?.data ?? []).map((s) => s.logo),
  ];
  if (globalThis.caches) {
    const cache = await caches.open(IMAGE_CACHE);
    await Promise.allSettled(
      images.filter(Boolean).map(async (url) => {
        const res = await fetch(url);
        if (res.ok) await cache.put(url, res);
      })
    );
  }

  // Que el navegador no borre estos datos si le falta espacio
  navigator.storage?.persist?.().catch(() => {});

  // ponytail: las ventas ya subidas se conservan una semana por si hay que
  // reimprimir un ticket; después solo estorban
  const cutoff = Date.now() - KEEP_SYNCED_MS;
  const sales = await listSales();
  await Promise.all(
    sales
      .filter((s) => s.status === 'synced' && new Date(s.sold_at).getTime() < cutoff)
      .map((s) => deleteSale(s.idempotency_key))
  );

  // Un provisional que ya se revisó en el sistema (se conservó o se desechó)
  // deja de ser un botón aparte en este equipo, salvo que aún tenga ventas
  // sin subir
  const locals = await getProvisionals();
  if (locals.length) {
    const live = new Set(catalog.filter((item) => item.provisional).map((item) => item.client_key));
    const waiting = sales.filter((s) => s.status !== 'synced');
    await setKV(
      'provisionals',
      locals.filter(
        (p) => !p.server_id || live.has(p.client_key) || usedLocally(waiting, p.client_key)
      )
    );
  }

  return { count: catalog.length, fetchedAt };
}

// ----------------------------------------------------------------------
// Cola: cobrar guarda la venta en el dispositivo; subirla es aparte
// ----------------------------------------------------------------------

// Devuelve la venta guardada, o null si esa llave ya estaba en la cola
// (doble toque en «Cobrar»)
export async function enqueueSale({ key, cart, itemsById, method, branchId }) {
  if ((await listSales()).some((s) => s.idempotency_key === key)) return null;
  const suppliers = (await getKV('context'))?.suppliers ?? [];
  // folio propio de cada proveedor que venda algo en esta venta («BD-…»)
  const ownerFolios = {};
  const owners = [
    ...new Set(cart.map((l) => itemsById.get(l.product_id)?.consignor_id).filter(Boolean)),
  ];
  for (const id of owners) {
    const prefix = suppliers.find((s) => s.id === id)?.ticket_prefix || `P${id}`;

    ownerFolios[id] = await nextFolio(prefix);
  }
  const sale = buildLocalSale({
    key,
    folio: await nextFolio(),
    soldAt: new Date().toISOString(),
    branchId,
    method,
    cart,
    itemsById,
    suppliers,
    ownerFolios,
  });
  if (!(await addSale(sale))) return null;
  await notePriceChanges(cart, itemsById);
  return sale;
}

// ----------------------------------------------------------------------
// Precios cambiados al cobrar: quedan en el equipo hasta que alguien decide,
// con red, si el nuevo se vuelve el precio del producto o fue solo esa venta
// ----------------------------------------------------------------------

const PRICE_REVIEW = 'priceReview';

async function notePriceChanges(cart, itemsById) {
  // los de último momento ya nacen con el precio que se les puso
  const changed = cart.filter(
    (l) => l.unit_price !== undefined && l.unit_price !== null && !isLocal(l.product_id)
  );
  if (!changed.length) return;
  const list = (await getKV(PRICE_REVIEW)) ?? [];
  changed.forEach((line) => {
    const item = itemsById.get(line.product_id);
    const entry = list.find((e) => e.product_id === line.product_id);
    if (entry) {
      if (!entry.prices.includes(line.unit_price)) entry.prices.push(line.unit_price);
    } else {
      list.push({
        product_id: line.product_id,
        animal_id: item.animal?.id ?? null,
        title: item.title,
        catalog_price: Number(item.price_retail),
        prices: [line.unit_price],
      });
    }
  });
  await setKV(PRICE_REVIEW, list);
}

// price: el que se guarda como precio del producto; null = se queda el que tenía
export async function resolvePriceChange(productId, price) {
  const entry = ((await getKV(PRICE_REVIEW)) ?? []).find((e) => e.product_id === productId);
  if (entry && price !== null) {
    // un animal se cambia por su ficha (el producto gemelo se sincroniza solo)
    if (entry.animal_id) {
      await axiosInstance.put(endpoints.animal.update(entry.animal_id), { price });
    } else {
      await axiosInstance.put(endpoints.product.update(productId), { price_retail: price });
    }
  }
  await setKV(
    PRICE_REVIEW,
    ((await getKV(PRICE_REVIEW)) ?? []).filter((e) => e.product_id !== productId)
  );
}

const REJECTED = [400, 404, 409, 422];

// Una red que acepta la conexión y se queda colgada no debe congelar la cola
const UPLOAD_TIMEOUT_MS = 20_000;

// Manda una venta. Devuelve 'synced' | 'review' | 'login' | 'skip' | 'stop'
async function upload(sale, { timeout, retried = false }) {
  // Se corta con abort (no con el timeout de axios) para que valga igual en
  // cualquier navegador
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    // Los productos de último momento se dan de alta antes que la venta
    const items = [];
    for (const { product_id, quantity, discount, unit_price } of sale.lines) {
      items.push({
        product_id: isLocal(product_id) ? await serverIdOf(product_id) : product_id,
        quantity,
        discount,
        // precio al vuelo: el servidor cobra ese (solo admin)
        ...(unit_price !== undefined ? { unit_price } : {}),
      });
    }
    const { data: res } = await axiosInstance.post(
      endpoints.sale.checkout,
      {
        branch_id: sale.branch_id,
        // con todos sus folios (uno por dueño), para encontrarla con cualquier ticket
        description: `Venta rápida · ${(sale.tickets?.map((t) => t.folio) ?? [sale.folio]).join(' · ')}`,
        items,
        // un pago debe ser mayor a cero: la venta de $0 (100 % de descuento) va sin él
        payments: sale.payment.amount > 0 ? [sale.payment] : [],
        // la misma llave en cada intento: el servidor devuelve la venta ya
        // hecha en vez de cobrar otra (por eso cortar y reintentar es seguro)
        idempotency_key: sale.idempotency_key,
        sold_at: sale.sold_at,
      },
      { signal: controller.signal }
    );
    const serverTotal = Number(res.total);
    const synced_at = new Date().toISOString();
    if (Math.abs(serverTotal - sale.totals.total) < 0.01) {
      await putSale({ ...sale, status: 'synced', sale_id: res.id, synced_at, reason: undefined });
      return 'synced';
    }
    // Ya quedó registrada (con otro total): no se reenvía, se avisa
    await putSale({
      ...sale,
      status: 'review',
      sale_id: res.id,
      synced_at,
      server_total: serverTotal,
      reason: `Se cobró ${fCurrency(sale.totals.total)}; el sistema registró ${fCurrency(serverTotal)}. Revisa el precio del producto.`,
    });
    return 'review';
  } catch (error) {
    if (REJECTED.includes(error.status)) {
      await putSale({ ...sale, status: 'review', reason: error.message });
      return 'review';
    }
    // Tras horas sin red el token ya caducó: se renueva y se reintenta una vez
    if (error.status === 401 && !retried) {
      try {
        await refreshSession();
      } catch {
        return 'login';
      }
      return upload(sale, { timeout, retried: true });
    }
    if (error.status === 401 || error.status === 403) return 'login';
    // El servidor falló con ESTA venta: se queda pendiente y siguen las demás
    if (error.status >= 500) return 'skip';
    return 'stop'; // sin red: se reintenta después
  } finally {
    clearTimeout(timer);
  }
}

let running = null;

// Sube las ventas pendientes en orden. Una sola corrida a la vez: quien
// llame mientras tanto recibe el resultado de la que ya está en curso.
export function syncQueue({ timeout = UPLOAD_TIMEOUT_MS } = {}) {
  if (!running) {
    running = (async () => {
      const result = { synced: 0, review: 0, pending: 0, needsLogin: false };
      const pending = (await listSales()).filter((s) => s.status === 'pending');
      for (let i = 0; i < pending.length; i += 1) {
        const outcome = await upload(pending[i], { timeout });
        if (outcome === 'synced' || outcome === 'review') {
          result[outcome] += 1;
        } else if (outcome === 'skip') {
          result.pending += 1;
        } else {
          result.needsLogin = outcome === 'login';
          result.pending += pending.length - i;
          break;
        }
      }
      return result;
    })().finally(() => {
      running = null;
    });
  }
  return running;
}

// «Reintentar» en una venta por revisar
export async function retrySale(key) {
  const sale = (await listSales()).find((s) => s.idempotency_key === key);
  if (!sale || sale.status !== 'review') return null;
  // El servidor ya la tiene (total distinto): solo se da por revisada
  if (sale.sale_id) {
    await putSale({ ...sale, status: 'synced' });
    return null;
  }
  await putSale({ ...sale, status: 'pending', reason: undefined });
  // Una subida en curso ya leyó la cola sin esta venta: se espera y se corre otra
  await running;
  return syncQueue();
}

// «Descartar»: borra del equipo una venta que el servidor rechazó y que no
// se va a registrar (deja de apartar stock). Las pendientes no se tocan.
export async function discardSale(key) {
  const sale = (await listSales()).find((s) => s.idempotency_key === key);
  if (sale?.status === 'review' && !sale.sale_id) await deleteSale(key);
}

// ----------------------------------------------------------------------
// Respaldo: lo que falta por subir, en un archivo
// ----------------------------------------------------------------------

export async function backupData() {
  const sales = (await listSales()).filter((s) => s.status !== 'synced');
  return { exported_at: new Date().toISOString(), sales };
}

export async function exportBackup() {
  const data = await backupData();
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `ventas-pendientes-${data.exported_at.slice(0, 16).replace(/[:T]/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
  return data.sales.length;
}
