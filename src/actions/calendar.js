import { useMemo } from 'react';
import useSWR, { mutate } from 'swr';

import axios, { fetcher, endpoints } from 'src/lib/axios';
import { success, warning, error as errorColor } from 'src/theme/core';

// ----------------------------------------------------------------------

const enableServer = false;

const CALENDAR_ENDPOINT = endpoints.calendar;

const swrOptions = {
  revalidateIfStale: enableServer,
  revalidateOnFocus: enableServer,
  revalidateOnReconnect: enableServer,
};

// ----------------------------------------------------------------------

function batchEventColor(expirationDate) {
  if (!expirationDate) return success.main;
  const diffDays = Math.ceil((new Date(expirationDate) - new Date()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return errorColor.darker;
  if (diffDays <= 7) return errorColor.main;
  if (diffDays <= 30) return warning.main;
  return success.main;
}

// ----------------------------------------------------------------------

export function useGetBatchCalendarEvents() {
  const url = [endpoints.productBatch.list, { params: { page: 1, page_size: 500 } }];
  const productUrl = [endpoints.product.list, { params: { page: 1, page_size: 500 } }];

  const { data: batchData, isLoading: batchLoading } = useSWR(url, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const { data: productData, isLoading: productLoading } = useSWR(productUrl, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  return useMemo(() => {
    const batches = batchData?.data ?? [];
    const products = productData?.data ?? [];
    const productMap = Object.fromEntries(products.map((p) => [p.id, p.title]));

    const events = batches
      .filter((b) => b.expiration_date)
      .map((b) => {
        const color = batchEventColor(b.expiration_date);
        const productName = productMap[b.product_id] ?? `Producto #${b.product_id}`;
        return {
          id: String(b.id),
          title: b.lot_code ? `${productName} (${b.lot_code})` : productName,
          start: b.expiration_date,
          end: b.expiration_date,
          allDay: true,
          color,
          textColor: '#fff',
          extendedProps: { batch: b, productName },
        };
      });

    return {
      events,
      eventsLoading: batchLoading || productLoading,
    };
  }, [batchData, productData, batchLoading, productLoading]);
}

// ----------------------------------------------------------------------

export function useGetEvents() {
  const { data, isLoading, error, isValidating } = useSWR(CALENDAR_ENDPOINT, fetcher, {
    ...swrOptions,
  });

  const memoizedValue = useMemo(() => {
    const events = data?.events.map((event) => ({ ...event, textColor: event.color }));

    return {
      events: events || [],
      eventsLoading: isLoading,
      eventsError: error,
      eventsValidating: isValidating,
      eventsEmpty: !isLoading && !isValidating && !data?.events.length,
    };
  }, [data?.events, error, isLoading, isValidating]);

  return memoizedValue;
}

// ----------------------------------------------------------------------

export async function createEvent(eventData) {
  /**
   * Work on server
   */
  if (enableServer) {
    const data = { eventData };
    await axios.post(CALENDAR_ENDPOINT, data);
  }

  /**
   * Work in local
   */
  mutate(
    CALENDAR_ENDPOINT,
    (currentData) => {
      const currentEvents = currentData?.events;

      const events = [...currentEvents, eventData];

      return { ...currentData, events };
    },
    false
  );
}

// ----------------------------------------------------------------------

export async function updateEvent(eventData) {
  /**
   * Work on server
   */
  if (enableServer) {
    const data = { eventData };
    await axios.put(CALENDAR_ENDPOINT, data);
  }

  /**
   * Work in local
   */
  mutate(
    CALENDAR_ENDPOINT,
    (currentData) => {
      const currentEvents = currentData?.events;

      const events = currentEvents.map((event) =>
        event.id === eventData.id ? { ...event, ...eventData } : event
      );

      return { ...currentData, events };
    },
    false
  );
}

// ----------------------------------------------------------------------

export async function deleteEvent(eventId) {
  /**
   * Work on server
   */
  if (enableServer) {
    const data = { eventId };
    await axios.patch(CALENDAR_ENDPOINT, data);
  }

  /**
   * Work in local
   */
  mutate(
    CALENDAR_ENDPOINT,
    (currentData) => {
      const currentEvents = currentData?.events;

      const events = currentEvents.filter((event) => event.id !== eventId);

      return { ...currentData, events };
    },
    false
  );
}
