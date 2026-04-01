import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------

const LOW_STOCK_THRESHOLD = 10;

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// ----------------------------------------------------------------------

function diffDays(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

// ----------------------------------------------------------------------

export function useNotifications() {
  const batchUrl = [endpoints.productBatch.list, { params: { page: 1, page_size: 500 } }];
  const productUrl = [endpoints.product.list, { params: { page: 1, page_size: 500 } }];

  const { data: batchData, isLoading: batchLoading } = useSWR(batchUrl, fetcher, swrOptions);
  const { data: productData, isLoading: productLoading } = useSWR(productUrl, fetcher, swrOptions);

  return useMemo(() => {
    const batches = batchData?.data ?? [];
    const products = productData?.data ?? [];
    const productMap = Object.fromEntries(products.map((p) => [p.id, p.title]));

    const notifications = [];

    batches.forEach((batch) => {
      const name = productMap[batch.product_id] ?? `Producto #${batch.product_id}`;
      const lot = batch.lot_code ? ` (${batch.lot_code})` : '';

      // Expiry notifications
      if (batch.expiration_date) {
        const days = diffDays(batch.expiration_date);

        if (days < 0) {
          notifications.push({
            id: `exp-${batch.id}`,
            type: 'expiring',
            severity: 'error',
            title: `Lote vencido`,
            message: `${name}${lot} venció hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}`,
            createdAt: new Date(),
            isUnRead: true,
            batchId: batch.id,
          });
        } else if (days <= 7) {
          notifications.push({
            id: `exp-${batch.id}`,
            type: 'expiring',
            severity: 'error',
            title: `Vence en ${days} día${days !== 1 ? 's' : ''}`,
            message: `${name}${lot}`,
            createdAt: new Date(),
            isUnRead: true,
            batchId: batch.id,
          });
        } else if (days <= 30) {
          notifications.push({
            id: `exp-${batch.id}`,
            type: 'expiring',
            severity: 'warning',
            title: `Vence en ${days} días`,
            message: `${name}${lot}`,
            createdAt: new Date(),
            isUnRead: false,
            batchId: batch.id,
          });
        }
      }

      // Low stock notifications
      if (batch.quantity !== null && batch.quantity <= LOW_STOCK_THRESHOLD && batch.quantity > 0) {
        notifications.push({
          id: `stock-${batch.id}`,
          type: 'low_stock',
          severity: 'info',
          title: `Stock bajo`,
          message: `${name}${lot} — quedan ${batch.quantity} unidades`,
          createdAt: new Date(),
          isUnRead: false,
          batchId: batch.id,
        });
      }
    });

    // Sort: errors first, then warnings, then info
    const order = { error: 0, warning: 1, info: 2 };
    notifications.sort((a, b) => order[a.severity] - order[b.severity]);

    return {
      notifications,
      notificationsLoading: batchLoading || productLoading,
      totalUnread: notifications.filter((n) => n.isUnRead).length,
    };
  }, [batchData, productData, batchLoading, productLoading]);
}
