import { http, HttpResponse } from 'msw';

// ----------------------------------------------------------------------
// Mock handlers — interceptan llamadas HTTP durante los tests.
// La baseURL no importa en jsdom, MSW intercepta por el path completo.
// ----------------------------------------------------------------------

const BASE = 'https://api.farmaciaselene.com';

export const handlers = [
  // Auth — login exitoso
  http.post(`${BASE}/api/v1/auth/token`, () =>
    HttpResponse.json({
      access_token:
        // JWT con payload { sub: "admin@farmaciaselene.com", id: 1, role: "admin", exp: 9999999999 }
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        'eyJzdWIiOiJhZG1pbkBmYXJtYWNpYXNlbGVuZS5jb20iLCJpZCI6MSwicm9sZSI6ImFkbWluIiwiZXhwIjo5OTk5OTk5OTk5fQ.' +
        'signature',
      refresh_token: 'mock-refresh-token',
    })
  ),

  // Dashboard stats
  http.get(`${BASE}/api/v1/dashboard/stats`, () =>
    HttpResponse.json({
      monthly_sales_count: 42,
      monthly_revenue: 15800.5,
      total_products: 120,
      expiring_batches_count: 5,
      expired_batches_count: 2,
      recent_sales: [],
      expiring_batches: [],
    })
  ),

  // Productos — primera página
  http.get(`${BASE}/api/v1/products/`, () =>
    HttpResponse.json({
      data: [
        { id: 1, name: 'Paracetamol 500mg', price: 12.5, stock: 100 },
        { id: 2, name: 'Ibuprofeno 400mg', price: 18.0, stock: 50 },
      ],
      total: 2,
      page: 1,
      page_size: 20,
      total_pages: 1,
    })
  ),

  // Calendario — eventos de lotes
  http.get(`${BASE}/api/v1/calendar/events`, () =>
    HttpResponse.json([
      {
        id: '1',
        title: 'Paracetamol Lote A',
        start: '2026-05-01',
        end: '2026-05-01',
        color: '#FFAB00',
      },
    ])
  ),
];
