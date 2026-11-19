// Como Promise.allSettled, pero de `size` en `size` para no saturar la API
// ponytail: tandas fijas (no un pool que rellena huecos); basta para decenas
export async function runInBatches(items, size, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.allSettled(items.slice(i, i + size).map(fn))));
  }
  return results;
}
