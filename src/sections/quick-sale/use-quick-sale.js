import { useMemo, useState, useEffect, useCallback } from 'react';

import { fCurrency } from 'src/utils/format-number';

import { provisionalItem } from './quick-sale-sync';
import { getKV, listSales } from './quick-sale-store';
import { usage, priced, stockOf, cartTotals, maxDiscount, spreadDiscount } from './quick-sale-math';

// Estado de la venta rápida: catálogo y ventas del dispositivo (IndexedDB)
// más la cuenta en curso. El stock no se guarda: es el del catálogo menos lo
// que el dispositivo vendió y aún no sube, menos lo que ya está en la cuenta.
export function useQuickSale() {
  const [state, setState] = useState({
    ready: false,
    items: null,
    fetchedAt: null,
    requestedAt: null,
    sales: [],
    priceReview: [],
    provisionals: [],
    suppliers: [],
    failed: false,
  });
  const [rawCart, setCart] = useState([]);

  const reload = useCallback(async () => {
    try {
      const [catalog, sales, saved, context, priceReview] = await Promise.all([
        getKV('catalog'),
        listSales(),
        getKV('provisionals'),
        getKV('context'),
        getKV('priceReview'),
      ]);
      // Los productos de último momento de este equipo van siempre con su id
      // local, aunque el catálogo ya los traiga dados de alta
      const provisionals = saved ?? [];
      const local = new Set(provisionals.map((p) => p.client_key));
      setState({
        ready: true,
        provisionals,
        suppliers: context?.suppliers ?? [],
        // guardado al «Preparar»: sirve sin internet
        businessName: context?.business?.business_name ?? null,
        items:
          catalog || provisionals.length
            ? [
                ...(catalog?.items ?? []).filter((item) => !local.has(item.client_key)),
                ...provisionals.map(provisionalItem),
              ]
            : null,
        fetchedAt: catalog?.fetchedAt ?? null,
        requestedAt: catalog?.requestedAt ?? null,
        sales,
        // precios cambiados al cobrar, para decidir si se guardan (con red)
        priceReview: priceReview ?? [],
        failed: false,
      });
    } catch {
      // El navegador no deja leer lo guardado (modo privado, disco lleno):
      // la pantalla lo dice en vez de quedarse cargando
      setState((prev) => ({ ...prev, ready: true, failed: true }));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const { items, sales, requestedAt } = state;

  const itemsById = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);

  // Un producto que salió del catálogo (lo desmarcaron) ya no se puede cobrar
  const cart = useMemo(
    () => rawCart.filter((l) => itemsById.has(l.product_id)),
    [rawCart, itemsById]
  );

  // Lo apartado por las ventas sin subir y por una cuenta `lines`
  const usedWith = useCallback(
    (lines) =>
      usage(
        [
          ...sales,
          {
            status: 'pending',
            lines: lines.map((l) => ({
              ...l,
              components: itemsById.get(l.product_id)?.components ?? [],
            })),
          },
        ],
        requestedAt
      ),
    [sales, itemsById, requestedAt]
  );

  const used = useMemo(() => usedWith(cart), [usedWith, cart]);

  const remaining = useCallback((item) => stockOf(item, used), [used]);

  const add = useCallback(
    (item) => {
      if (item.blocked_reason) return;
      setCart((prev) => {
        const left = stockOf(item, usedWith(prev));
        if (left !== null && left < 1) return prev;
        const line = prev.find((l) => l.product_id === item.id);
        if (!line) return [...prev, { product_id: item.id, quantity: 1, discount: 0 }];
        return prev.map((l) => (l === line ? { ...l, quantity: l.quantity + 1 } : l));
      });
    },
    [usedWith]
  );

  const setQuantity = useCallback(
    (productId, quantity) => {
      setCart((prev) => {
        const others = prev.filter((l) => l.product_id !== productId);
        if (quantity <= 0) return others;
        const item = itemsById.get(productId);
        const left = item ? stockOf(item, usedWith(others)) : null;
        const next = left === null ? quantity : Math.min(quantity, left);
        if (next <= 0) return others;
        return prev.map((l) => {
          if (l.product_id !== productId) return l;
          const cap = item ? maxDiscount(priced(item, l), next) : null;
          return {
            ...l,
            quantity: next,
            discount: cap === null ? l.discount : Math.min(l.discount, cap),
          };
        });
      });
    },
    [itemsById, usedWith]
  );

  // Devuelve el mensaje de error, o null si se aplicó
  const setDiscount = useCallback(
    (productId, amount) => {
      const line = cart.find((l) => l.product_id === productId);
      const item = priced(itemsById.get(productId), line);
      if (!line || !item) return 'Ese producto ya no está en la cuenta';
      const value = Math.max(0, Math.round(Number(amount || 0) * 100) / 100);
      const cap = maxDiscount(item, line.quantity);
      if (cap !== null && value > cap) {
        return `El descuento máximo para ${item.title} es ${item.max_discount}% (${fCurrency(cap)} en esta línea)`;
      }
      if (value > Number(item.price_retail) * line.quantity) {
        return 'El descuento no puede ser mayor que el importe de la línea';
      }
      setCart((prev) =>
        prev.map((l) => (l.product_id === productId ? { ...l, discount: value } : l))
      );
      return null;
    },
    [cart, itemsById]
  );

  // Precio al vuelo (solo admin): esta línea se cobra a `price`; el producto
  // no cambia hasta que se revise. Igual al del catálogo = sin cambio. El
  // descuento de la línea se quita: era sobre el precio anterior. Si aún no
  // está en la cuenta (desde la tarjeta), entra con una pieza a ese precio.
  const setPrice = useCallback(
    (productId, price) => {
      const item = itemsById.get(productId);
      if (!item) return 'Ese producto ya no está';
      const value = Math.round(Number(price) * 100) / 100;
      if (!Number.isFinite(value) || value < 0) return 'Escribe un precio válido';
      const unitPrice = value === Number(item.price_retail) ? null : value;
      setCart((prev) => {
        if (!prev.some((l) => l.product_id === productId)) {
          const left = stockOf(item, usedWith(prev));
          if (item.blocked_reason || (left !== null && left < 1)) return prev;
          return [
            ...prev,
            { product_id: productId, quantity: 1, discount: 0, unit_price: unitPrice },
          ];
        }
        return prev.map((l) =>
          l.product_id === productId ? { ...l, unit_price: unitPrice, discount: 0 } : l
        );
      });
      return null;
    },
    [itemsById, usedWith]
  );

  // Mismo % en todas las líneas; devuelve los pesos que no cupieron por topes
  const discountAll = useCallback(
    (percent) => {
      const result = spreadDiscount(cart, itemsById, percent);
      setCart(result.lines);
      return result.unapplied;
    },
    [cart, itemsById]
  );

  const clear = useCallback(() => setCart([]), []);

  const totals = useMemo(() => cartTotals(cart, itemsById), [cart, itemsById]);

  const counts = useMemo(
    () => ({
      pending: sales.filter((s) => s.status === 'pending').length,
      review: sales.filter((s) => s.status === 'review').length,
    }),
    [sales]
  );

  return {
    ready: state.ready,
    failed: state.failed,
    provisionals: state.provisionals,
    suppliers: state.suppliers,
    businessName: state.businessName,
    items,
    itemsById,
    fetchedAt: state.fetchedAt,
    sales,
    priceReview: state.priceReview,
    cart,
    totals,
    counts,
    stockOf: remaining,
    add,
    setQuantity,
    setDiscount,
    setPrice,
    discountAll,
    clear,
    reload,
  };
}
