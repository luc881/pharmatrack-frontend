# Provisionales, órdenes de preparación y corte por dueño — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En la venta rápida, vender productos que nadie dio de alta (y revisarlos después), imprimir un talón de orden para lo que se prepara, y sacar un corte por dueño.

**Architecture:** Tres columnas nuevas en `products` (`provisional` + `client_key`, `needs_prep`, `consignor_id`). El equipo crea provisionales en IndexedDB con id `local:<client_key>`; `syncQueue` los crea en el servidor (idempotente) antes de subir ventas y cambia el id local por el real. El talón es una segunda página del ticket local. El corte es una consulta agregada sobre `sale_details`.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic + pytest; React 19 + MUI 7 + SWR + Vitest/MSW + fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-11-14-convencion-provisionales-preparacion-consigna-design.md`

## Global Constraints

- Repos: `C:\Users\luc88\dev\pharmatrack-api` y `C:\Users\luc88\dev\pharmatrack-frontend`, rama `feat/convencion-extras` en ambos.
- TDD: cada cambio con su prueba que falla primero. API: `poetry run pytest`. Dashboard: `./node_modules/.bin/vitest run`; yarn solo como `corepack yarn`.
- La pantalla de venta rápida lee de IndexedDB y cobra contra la cola local; nada nuevo depende de la red para cobrar.
- Sin iconos de Iconify en `src/sections/quick-sale/`.
- El total local debe igualar al del servidor: el precio no viaja en la venta.
- Textos en español. Commits `feat(x): …` con `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- No hacer push, merge ni desplegar sin que el dueño lo pida.
- Prettier solo sobre archivos tocados que ya estaban formateados.

## Review Focus

- Venta con línea `local:` cuyo provisional falla al crearse (5xx, 400): la venta queda pendiente/por revisar, no se pierde ni se sube con id inválido.
- Dos equipos crean un provisional con el mismo nombre: no chocan (slug/sku únicos).
- Provisional creado y vendido, luego el catálogo baja con ese producto ya real: un solo botón, y el stock/uso local no se duplica.
- Venta ya guardada en IndexedDB antes de esta versión (sin `needs_prep`): el ticket se imprime sin talón y sin error.
- Corte por dueño con venta cancelada o devolución: no cuenta lo cancelado.

---

### Task 1 (API): columnas y catálogo

**Files:**
- Create: `migrations/versions/convextras01_add_provisional_prep_consignor_to_products.py` (revises `quicksale01`)
- Modify: `src/pharmatrack/models/products/orm.py`, `schemas.py`, `src/pharmatrack/api/routes/products.py`
- Test: `tests/test_convention_extras.py`

**Interfaces — Produces:**
- `products.provisional` bool default false; `products.client_key` String(64) unique nullable; `products.needs_prep` bool default false; `products.consignor_id` BigInteger FK `suppliers.id` nullable (ON DELETE SET NULL).
- Product create/update/response aceptan y devuelven `needs_prep`, `consignor_id`, `provisional`.
- `QuickSaleItem` añade `needs_prep: bool`, `provisional: bool`, `client_key: Optional[str]`, `consignor_id: Optional[int]`.
- `GET /products?provisional=true|false` filtra.

- [ ] Prueba: `test_product_new_fields_default_and_update` (crear → `needs_prep False, consignor_id None, provisional False`; PUT con `needs_prep True` y `consignor_id` de un proveedor creado → se guardan; `consignor_id` inexistente → 400).
- [ ] Prueba: `test_quick_sale_catalog_includes_new_fields`.
- [ ] Correr: fallan. Implementar migración, ORM, schemas, filtro y catálogo. Correr: pasan.
- [ ] `alembic upgrade head` en la base local (`DATABASE_URL=postgresql://postgres:postgres@localhost/pharmatrack`).
- [ ] Commit `feat(productos): provisional, se prepara y de quién es`.

### Task 2 (API): crear provisional

**Files:** Modify `routes/products.py`, `models/products/schemas.py`; Test `tests/test_convention_extras.py`

**Interfaces — Produces:**
- `POST /api/v1/products/provisional` (antes de `/{product_id}`; `CAN_CREATE_SALES`), body `ProvisionalCreate{client_key: str(8..64), title: str(1..250), price_retail: Decimal>0, needs_prep: bool=False, consignor_id: Optional[int]}` (extra forbid) → 201 `QuickSaleItem`.
- Idempotente por `client_key`: repetir (aunque cambien otros campos) devuelve el existente con 201. Carrera: `IntegrityError` → devolver el existente.
- Crea con `provisional=True, quick_sale=True, tracks_batches=False, price_cost=0, unit_name="pieza", show_online=False, is_active=True`, categoría «De último momento» (se crea si no existe), `sku=None`, slug = slug del título + `-` + primeros 8 de `client_key`.

- [ ] Pruebas: `test_provisional_create_and_sell` (crear → aparece en el catálogo → checkout con su id cobra `price_retail` sin stock), `test_provisional_is_idempotent`, `test_provisional_same_title_two_devices`, `test_provisional_requires_login`, `test_provisional_bad_consignor_400`.
- [ ] RED → implementar → GREEN. Commit `feat(productos): alta de producto provisional desde la venta rápida`.

### Task 3 (API): revisión y corte por dueño

**Files:** Modify `routes/products.py`, `routes/sales.py`, schemas; Test `tests/test_convention_extras.py`

**Interfaces — Produces:**
- `GET /api/v1/products/provisional` (`CAN_READ_PRODUCTS`) → `list[ProvisionalReview{id, title, price_retail, is_active, needs_prep, consignor_id, units_sold: float, amount: Decimal, created_at}]`, solo `provisional=True`, ventas `completed`.
- Conservar: `PUT /products/{id}` con `provisional: false`. Desechar: `PUT` con `is_active: false, quick_sale: false` (sigue `provisional`; el listado lo muestra como desechado).
- `GET /api/v1/sales/report/by-owner?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&branch_id=` (antes de `/{sale_id}`; `CAN_READ_SALES`) → `list[OwnerCut{consignor_id: Optional[int], owner: str ("Propio" si null), units: float, amount: Decimal, products: list[{product_id, title, units, amount}]}]`. Solo ventas `completed`; `amount` = suma de `sale_details.total`; fechas en hora de México sobre `date_sale` (UTC), ambos extremos incluidos; orden: Propio primero, luego por nombre.

- [ ] Pruebas: `test_provisional_review_lists_sold_units`, `test_owner_cut_splits_mixed_ticket` (un checkout con producto propio y de consigna → dos dueños con sus importes, suma = total), `test_owner_cut_ignores_cancelled_and_other_dates`, `test_owner_cut_requires_login`.
- [ ] RED → implementar → GREEN. Correr la suite completa del API. Commit `feat(ventas): corte por dueño y revisión de provisionales`.

### Task 4 (Dashboard): campos en producto y catálogo local

**Files:** Modify `src/lib/axios.js` (endpoints `product.provisional`, `sale.byOwner`), `src/sections/product/product-create-edit-form.jsx`, `src/sections/quick-sale/quick-sale-sync.js`; Test `src/test/quick-sale/quick-sale-sync.test.js`, prueba existente del formulario de producto si la hay.

**Interfaces — Produces:**
- Formulario de producto: interruptor «Se prepara al momento» (`needs_prep`) y selector «De quién es» (`consignor_id`; «Propio» = null; opciones de `useGetSuppliers`).
- `prepareOffline` guarda además `context.suppliers: [{id, name}]` (petición opcional: si falla conserva lo anterior).
- `buildLocalSale` copia `needs_prep` del item a cada línea.

- [ ] Pruebas → RED → implementar → GREEN. Commit `feat(productos): se prepara y de quién es en el formulario`.

### Task 5 (Dashboard): provisionales en el equipo

**Files:** Modify `quick-sale-store.js` (nada si `kv` basta), `quick-sale-sync.js`, `use-quick-sale.js`, `view/quick-sale-view.jsx`; Create `quick-sale-new-product.jsx`; Test `src/test/quick-sale/quick-sale-provisional.test.jsx`

**Interfaces — Produces:**
- `kv['provisionals']`: `[{client_key, title, price_retail, needs_prep, consignor_id, server_id?}]`.
- `addProvisional({title, price_retail, needs_prep, consignor_id}) → item`; `localId(client_key) = 'local:' + client_key`.
- `useQuickSale().items` = catálogo + provisionales locales cuyo `client_key` no venga ya en el catálogo, con forma de `QuickSaleItem` (`id: localId`, `category: 'De último momento'`, `stock: null`, `components: []`, `provisional: true`).
- `syncQueue`: antes del bucle, para cada provisional sin `server_id` hace `POST endpoints.product.provisional` y guarda `server_id`; fallo de red → `stop`; 5xx → se salta; 4xx → sus ventas pasan a «por revisar» con el motivo. En `upload`, cada `product_id` `local:` se cambia por su `server_id`; si falta, la venta devuelve `skip`.
- «+ Producto nuevo» en la cabecera (habilitado sin red): diálogo con nombre, precio (acepta coma), «Se prepara» y «De quién es» (de `context.suppliers`).

- [ ] Pruebas: crear sin red y vender → queda en cola con `local:`; al volver la red se crea una vez y la venta sube con el id real; reintento no duplica (misma `client_key`); catálogo que ya lo trae → un solo botón; provisional rechazado (400) → venta por revisar; 5xx → venta pendiente y las demás suben.
- [ ] RED → implementar → GREEN. Commit `feat(venta-rápida): productos de último momento sin internet`.

### Task 6 (Dashboard): talón de orden

**Files:** Modify `src/sections/sale/sale-ticket.jsx` (exportar CSS/clases si hace falta), `view/quick-sale-ticket-view.jsx`, `view/quick-sale-view.jsx`, `src/sections/sale/view/sale-ticket-view.jsx` (`TicketPrintPage` acepta `extra` tras el ticket y `ticket` opcional); Create `src/sections/quick-sale/prep-order.jsx`; Test `src/test/quick-sale/quick-sale-ticket.test.jsx`

**Interfaces — Produces:**
- `PrepOrder({folio, soldAt, lines, width})`: título «ORDEN», folio, hora, y `cantidad × nombre` por línea `needs_prep`, letra grande; `break-before: page`.
- Ticket local con `?print=1&only=order` imprime solo el talón.
- `charge`: si la venta tiene líneas `needs_prep` y «Imprimir ticket» está apagado, navega al ticket con `only=order`.

- [ ] Pruebas: venta con 3 limón $100 + 2 mango $50 + 1 cueva → talón con «3 ×» y «2 ×» de slushies y sin la cueva ni precios; venta sin `needs_prep` (y venta vieja sin el campo) → sin talón; `only=order` → sin ticket del cliente; cobrar con impresión apagada y línea de preparación → navega al talón.
- [ ] RED → implementar → GREEN. Commit `feat(venta-rápida): talón de orden para lo que se prepara`.

### Task 7 (Dashboard): páginas «Productos por revisar» y «Corte por dueño»

**Files:** Create `src/actions/convention.js` (`useGetProvisionals`, `keepProvisional(id)`, `discardProvisional(id)`, `useOwnerCut({from, to})`), `src/sections/product/view/product-provisional-view.jsx`, `src/sections/sale/view/sale-owner-cut-view.jsx`, páginas en `src/pages/dashboard/product/provisional.jsx` y `src/pages/dashboard/sale/owner-cut.jsx`; Modify `src/routes/paths.js`, `src/routes/sections/dashboard.jsx` (guards `products.update` y `sales.read`), pestañas/menú de Productos y Ventas; Test `src/test/convention/*.test.jsx`

**Interfaces — Consumes:** `GET /products/provisional`, `PUT /products/{id}`, `GET /sales/report/by-owner`.

- [ ] Pruebas: la lista muestra vendido e importe; «Completar y conservar» lleva a editar el producto y manda `provisional: false` al guardar desde ahí (o botón directo «Conservar»); «Desechar» confirma y manda `is_active: false`; el corte muestra una tarjeta por dueño con total y tabla, y vuelve a pedir al cambiar fechas.
- [ ] RED → implementar → GREEN. Suite completa del dashboard + `corepack yarn build`. Actualizar `CLAUDE.md` (sección «Venta rápida sin internet»). Commit `feat(convención): productos por revisar y corte por dueño`.

### Task 8: revisión final y entrega

- [ ] Revisión de toda la rama contra el spec y el Review Focus; corregir lo Crítico/Importante con prueba.
- [ ] Entregar al dueño: decisiones tomadas, menores diferidos, pasos previos al evento (dar de alta al otro expositor como proveedor, los 6 slushies con «Se prepara», driver en «cortar por página», volver a «Preparar»). No hacer push ni desplegar sin que lo pida.
