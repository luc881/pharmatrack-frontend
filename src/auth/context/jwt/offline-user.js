import { getKV, setKV } from 'src/sections/quick-sale/quick-sale-store';

// El usuario que la venta rápida guarda en el equipo al «Preparar»
// (context.user en IndexedDB). Si el navegador no tiene IndexedDB, no hay.

export async function savedOfflineUser() {
  try {
    return (await getKV('context'))?.user ?? null;
  } catch {
    return null;
  }
}

export async function forgetOfflineUser() {
  try {
    const context = await getKV('context');
    if (context?.user) await setKV('context', { ...context, user: null });
  } catch {
    // sin IndexedDB no hay nada que borrar
  }
}
