import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';

import { fetcher, endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------

const LOW_STOCK_THRESHOLD = 10;

// Umbrales farmacéuticos (WHO / almacenamiento temperatura controlada)
const TEMP_WARNING  = 25; // °C — temperatura máxima recomendada
const TEMP_CRITICAL = 30; // °C — temperatura crítica
const HUM_WARNING   = 60; // %  — humedad máxima recomendada
const HUM_CRITICAL  = 70; // %  — humedad crítica

// Si la lectura tiene más de 2 minutos, no generamos alertas de sensor
const SENSOR_OFFLINE_MS = 2 * 60 * 1000;

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// ----------------------------------------------------------------------

const parseUTC = (ts) => new Date(/Z|[+-]\d{2}:?\d{2}$/.test(ts) ? ts : `${ts}Z`);

function diffDays(dateStr) {
  return Math.ceil((parseUTC(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

// ----------------------------------------------------------------------

export function useNotifications({ enabled = false } = {}) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const batchUrl   = enabled ? [endpoints.productBatch.list, { params: { page: 1, page_size: 500 } }] : null;
  const productUrl = enabled ? [endpoints.product.list,      { params: { page: 1, page_size: 500 } }] : null;
  const sensorUrl  = enabled ? endpoints.sensor.latest : null;

  const { data: batchData,   isLoading: batchLoading   } = useSWR(batchUrl,   fetcher, swrOptions);
  const { data: productData, isLoading: productLoading } = useSWR(productUrl, fetcher, swrOptions);
  const { data: sensorData,  isLoading: sensorLoading  } = useSWR(sensorUrl,  fetcher, {
    ...swrOptions,
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

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

    // Sensor alerts — solo si hay lectura reciente (≤ 2 min)
    if (sensorData?.recorded_at) {
      const age = now - parseUTC(sensorData.recorded_at).getTime();
      if (age < SENSOR_OFFLINE_MS) {
        const temp = sensorData.temperature ?? null;
        const hum  = sensorData.humidity    ?? null;

        if (temp !== null) {
          if (temp > TEMP_CRITICAL) {
            notifications.push({
              id: 'sensor-temp-critical',
              type: 'sensor_alert',
              severity: 'error',
              title: `Temperatura crítica: ${temp.toFixed(1)}°C`,
              message: `Supera el límite de ${TEMP_CRITICAL}°C — revisa condiciones de almacenamiento`,
              createdAt: new Date(),
              isUnRead: true,
            });
          } else if (temp > TEMP_WARNING) {
            notifications.push({
              id: 'sensor-temp-warning',
              type: 'sensor_alert',
              severity: 'warning',
              title: `Temperatura elevada: ${temp.toFixed(1)}°C`,
              message: `Por encima de ${TEMP_WARNING}°C recomendados para farmacia`,
              createdAt: new Date(),
              isUnRead: true,
            });
          }
        }

        if (hum !== null) {
          if (hum > HUM_CRITICAL) {
            notifications.push({
              id: 'sensor-hum-critical',
              type: 'sensor_alert',
              severity: 'error',
              title: `Humedad crítica: ${hum.toFixed(0)}%`,
              message: `Supera el límite de ${HUM_CRITICAL}% — riesgo de deterioro de medicamentos`,
              createdAt: new Date(),
              isUnRead: true,
            });
          } else if (hum > HUM_WARNING) {
            notifications.push({
              id: 'sensor-hum-warning',
              type: 'sensor_alert',
              severity: 'warning',
              title: `Humedad elevada: ${hum.toFixed(0)}%`,
              message: `Por encima del ${HUM_WARNING}% recomendado para farmacia`,
              createdAt: new Date(),
              isUnRead: true,
            });
          }
        }
      }
    }

    // Sort: errors first, then warnings, then info
    const order = { error: 0, warning: 1, info: 2 };
    notifications.sort((a, b) => order[a.severity] - order[b.severity]);

    return {
      notifications,
      notificationsLoading: batchLoading || productLoading || sensorLoading,
      totalUnread: notifications.filter((n) => n.isUnRead).length,
    };
  }, [batchData, productData, sensorData, batchLoading, productLoading, sensorLoading, now]);
}
