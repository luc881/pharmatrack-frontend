// Lo que la venta rápida guarda en el dispositivo (IndexedDB) para poder
// vender sin internet:
//   kv     → 'catalog' {items, fetchedAt}, 'context', 'device' {id, counter}, 'prefs'
//   queue  → ventas del dispositivo, por idempotency_key
// ponytail: se abre la base en cada operación; con decenas de ventas por
// evento no hace falta conservar la conexión.

const DB_NAME = 'quick-sale';
const KV = 'kv';
const QUEUE = 'queue';

const done = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

function open() {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore(KV);
    request.result.createObjectStore(QUEUE, { keyPath: 'idempotency_key' });
  };
  return done(request);
}

// Corre `work(store)` en una transacción y resuelve cuando ya quedó escrita
async function tx(storeName, mode, work) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      let result;
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      Promise.resolve(work(transaction.objectStore(storeName))).then((value) => {
        result = value;
      }, reject);
    });
  } finally {
    db.close();
  }
}

export const getKV = (key) => tx(KV, 'readonly', (store) => done(store.get(key)));

export const setKV = (key, value) => tx(KV, 'readwrite', (store) => done(store.put(value, key)));

export const listSales = async () => {
  const all = await tx(QUEUE, 'readonly', (store) => done(store.getAll()));
  return all.sort((a, b) => String(a.sold_at).localeCompare(String(b.sold_at)));
};

export const putSale = (sale) => tx(QUEUE, 'readwrite', (store) => done(store.put(sale)));

// Inserta solo si la llave es nueva: un doble toque en «Cobrar» no duplica
// ni pisa la venta. Devuelve false si ya existía.
export const addSale = (sale) =>
  tx(QUEUE, 'readwrite', async (store) => {
    if (await done(store.get(sale.idempotency_key))) return false;
    await done(store.add(sale));
    return true;
  });

export const deleteSale = (key) => tx(QUEUE, 'readwrite', (store) => done(store.delete(key)));

const randomId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), (n) => chars[n % chars.length]).join(
    ''
  );
};

// Folio del ticket sin internet: VR-<dispositivo>-<consecutivo>. Leer y
// escribir van en la misma transacción para que dos cobros no lo repitan.
export const nextFolio = () =>
  tx(KV, 'readwrite', async (store) => {
    const device = (await done(store.get('device'))) ?? { id: randomId(), counter: 0 };
    device.counter += 1;
    await done(store.put(device, 'device'));
    return `VR-${device.id}-${String(device.counter).padStart(4, '0')}`;
  });
