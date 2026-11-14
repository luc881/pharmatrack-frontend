# Venta rápida y venta sin internet — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una pantalla de venta rápida con botones para los productos marcados, que también vende sin internet y sube las ventas sola al reconectar.

**Architecture:** El API gana una bandera `quick_sale`, un endpoint que entrega el catálogo de venta rápida en una sola petición y `sold_at` en el checkout (que ya es idempotente). El frontend guarda catálogo, contexto y cola de ventas en IndexedDB; la pantalla siempre lee de ahí y siempre encola, con o sin red. El stock local no se guarda: se deriva de `stock del catálogo − ventas sin subir`. Un service worker precarga la app.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic + pytest · React 19 + MUI + SWR + Vite 7 + Vitest/MSW · `vite-plugin-pwa` (nueva) · `fake-indexeddb` (nueva, solo pruebas).

**Spec:** `pharmatrack-frontend/docs/superpowers/specs/2026-11-14-venta-rapida-offline-design.md`

## Global Constraints

- Dos repos: `pharmatrack-api` (tareas A1-A3) y `pharmatrack-frontend` (F1-F9). En ambos, rama `feat/venta-rapida` desde `main`. El API se despliega antes que el frontend (`alembic upgrade head` corre solo al arrancar).
- Fecha límite: ensayo el 2026-11-20, convención el 2026-11-22. Fase 1 = A1-A3 + F1-F4 (se puede desplegar sola). Fase 2 = F5-F9.
- Total local = igual que el servidor: por línea `price_retail × cantidad − descuento`, impuesto `tax_percentage %` sobre ese subtotal, total = suma. Se calcula en centavos enteros.
- Tope de descuento por línea: `price_retail × cantidad × max_discount / 100`; `max_discount` nulo = sin tope.
- No existe stock negativo ni descuento a nivel venta en el API; no se agregan.
- La venta normal (`sale-create-edit-form.jsx`) y el modo convención no cambian de comportamiento.
- Sin nombres de marca fijos: `CONFIG.appName`, `VITE_BRAND_DIR`, «Datos del negocio».
- Preferencias por cuenta van en `app_settings`, no en `localStorage`.
- Texto de la interfaz en español, botones con texto visible. Commits en español, estilo `feat(ventas): …`.
- Frontend: `yarn`, nunca `npm`. Pruebas: `yarn test <archivo> --run`. API: `poetry run pytest <archivo> -v`.
- Timestamps: UTC sin zona (el frontend interpreta todo como UTC).

## Review Focus

1. **Catálogo refrescado con ventas sin subir:** al volver a descargar el catálogo con 3 ventas pendientes, el stock mostrado debe seguir descontándolas (prueba en F2).
2. **Doble toque en «Cobrar»:** dos toques seguidos producen una sola venta en la cola (prueba en F6).
3. **Respuesta perdida:** el servidor registra la venta pero la respuesta no llega; al reintentar con la misma llave la venta queda `synced`, no duplicada (prueba en F6).
4. **Token caducado sin red a media sesión:** el temporizador de renovación no cierra la sesión ni manda al login (prueba en F8).
5. **Sin preparar y sin red:** abrir la venta rápida sin catálogo local muestra «Prepara la venta rápida con internet antes de salir», no una pantalla en blanco ni un error (prueba en F7).

---

## Mapa de archivos

**pharmatrack-api**

| Archivo | Responsabilidad |
|---|---|
| `migrations/versions/quicksale01_add_quick_sale_to_products.py` | Columna `products.quick_sale` |
| `src/pharmatrack/models/products/orm.py`, `schemas.py` | Bandera + schemas `QuickSaleItem`, `QuickSaleComponent` |
| `src/pharmatrack/api/routes/products.py` | Filtro, `toggle-quick-sale`, `GET /quick-sale` |
| `src/pharmatrack/models/sales/schemas.py`, `api/routes/sales.py` | `sold_at` |
| `tests/test_quick_sale.py`, `tests/test_sales_checkout.py` | Pruebas |

**pharmatrack-frontend** (`src/sections/quick-sale/`)

| Archivo | Responsabilidad |
|---|---|
| `quick-sale-math.js` | Funciones puras: totales, topes, reparto de descuento, stock derivado |
| `quick-sale-store.js` | IndexedDB: `kv` y `queue` |
| `quick-sale-sync.js` | Preparar, encolar, sincronizar, respaldo |
| `use-quick-sale.js` | Hook: une store + math + estado del carrito |
| `quick-sale-grid.jsx`, `quick-sale-cart.jsx`, `quick-sale-picker.jsx`, `quick-sale-status.jsx` | Botones, cuenta y cobro, «+ Agregar productos», barra de estado |
| `view/quick-sale-view.jsx`, `view/quick-sale-ticket-view.jsx` | Pantalla y ticket local |

Además: `src/actions/product.js`, `src/lib/axios.js`, `src/routes/paths.js`, `src/routes/sections/dashboard.jsx`, `src/layouts/nav-config-dashboard.jsx`, `src/pages/dashboard/quick-sale/`, `src/sections/product/product-create-edit-form.jsx`, `src/sections/sale/sale-ticket.jsx`, `src/sections/sale/view/sale-ticket-view.jsx`, `src/sections/sale/print-ticket.js`, `src/auth/context/jwt/{auth-provider.jsx,utils.js}`, `vite.config.js`, `src/main.jsx`, `public/brand/*/favicon/site.webmanifest`.

---

## Fase 1 — API

### Task A1: Bandera `quick_sale`

**Files:**
- Create: `migrations/versions/quicksale01_add_quick_sale_to_products.py` (`revision="quicksale01"`, `down_revision="orderip01"`; confirmar con `poetry run alembic heads`)
- Modify: `src/pharmatrack/models/products/orm.py` (junto a `show_online`), `src/pharmatrack/models/products/schemas.py` (`ProductBase`/create: `quick_sale: bool = False`; `ProductUpdate`: `Optional[bool] = None`), `src/pharmatrack/api/routes/products.py`
- Test: `tests/test_quick_sale.py`

**Interfaces:**
- Produces: campo `quick_sale` en toda respuesta de producto; `GET /api/v1/products?quick_sale=true`; `PATCH /api/v1/products/{id}/toggle-quick-sale` → `ProductResponse` (mismos permisos y forma que `toggle-online`).

- [ ] **Step 1: Pruebas que fallan** (helpers `_make_product`, `_add_batch` como en `tests/test_bundles.py`)

```python
def test_quick_sale_defaults_false_and_toggles(auth_headers, test_product_category):
    p = _make_product(auth_headers, test_product_category.id)
    assert p["quick_sale"] is False
    res = client.patch(f"/api/v1/products/{p['id']}/toggle-quick-sale", headers=auth_headers)
    assert res.status_code == 200 and res.json()["quick_sale"] is True

def test_list_filters_by_quick_sale(auth_headers, test_product_category):
    a = _make_product(auth_headers, test_product_category.id, sku="A1", quick_sale=True)
    _make_product(auth_headers, test_product_category.id, sku="B1", title="Otro")
    res = client.get("/api/v1/products?quick_sale=true", headers=auth_headers)
    assert [p["id"] for p in res.json()["data"]] == [a["id"]]
```

- [ ] **Step 2:** `poetry run pytest tests/test_quick_sale.py -v` → FAIL (campo desconocido / 404)
- [ ] **Step 3:** Migración (`sa.Boolean(), nullable=False, server_default=sa.false()`), ORM, schemas, filtro `quick_sale: bool | None` en `read_all`, endpoint `toggle_product_quick_sale` copiando `toggle_product_online`.
- [ ] **Step 4:** `poetry run pytest tests/test_quick_sale.py tests/test_products.py -v` → PASS
- [ ] **Step 5:** Commit `feat(productos): bandera de venta rápida`

### Task A2: `GET /products/quick-sale`

**Files:**
- Modify: `src/pharmatrack/models/products/schemas.py`, `src/pharmatrack/api/routes/products.py` (declarar la ruta **antes** de `/{product_id}`)
- Test: `tests/test_quick_sale.py`

**Interfaces:**
- Produces: `GET /api/v1/products/quick-sale` (dependencia `CAN_CREATE_SALES`) → `list[QuickSaleItem]`, ordenada por categoría y título. Solo productos con `quick_sale`, `is_active` y sin `deleted_at`.

```python
class QuickSaleComponent(BaseModel):
    product_id: int
    quantity: int
    stock: Optional[float]          # None = componente sin control de lotes

class QuickSaleItem(BaseModel):
    id: int
    title: str
    image: Optional[str]
    category: Optional[str]         # nombre de la categoría
    price_retail: Decimal
    tax_percentage: Optional[float]
    max_discount: Optional[float]
    stock: Optional[float]          # suma de lotes; None = sin control de lotes o paquete
    is_bundle: bool
    components: list[QuickSaleComponent]   # vacío si no es paquete
    blocked_reason: Optional[Literal["reserved", "deceased", "not_for_sale"]]
    animal: Optional[AnimalResponse]       # el gemelo, para el nombre científico del ticket
```

`blocked_reason` sigue las tres reglas de `_complete` en `sales.py` (en ese orden), evaluadas sobre el producto o, en un paquete, sobre cualquiera de sus componentes.

- [ ] **Step 1: Pruebas que fallan**

```python
def test_quick_sale_catalog_stock_and_bundle(auth_headers, test_product_category, db_session):
    cueva = _make_product(auth_headers, test_product_category.id, sku="C1", quick_sale=True, tax_percentage=16, max_discount=10)
    _add_batch(db_session, cueva["id"], 5); _add_batch(db_session, cueva["id"], 3)
    pack = _make_product(auth_headers, test_product_category.id, sku="P1", title="3 cuevas", quick_sale=True, tracks_batches=False, price_retail=200)
    client.put(f"/api/v1/products/{pack['id']}/bundle-items", json=[{"component_product_id": cueva["id"], "quantity": 3}], headers=auth_headers)
    _make_product(auth_headers, test_product_category.id, sku="X1", title="No marcado")

    items = {i["id"]: i for i in client.get("/api/v1/products/quick-sale", headers=auth_headers).json()}
    assert set(items) == {cueva["id"], pack["id"]}
    assert items[cueva["id"]]["stock"] == 8 and items[cueva["id"]]["max_discount"] == 10
    assert items[pack["id"]]["is_bundle"] is True and items[pack["id"]]["stock"] is None
    assert items[pack["id"]]["components"] == [{"product_id": cueva["id"], "quantity": 3, "stock": 8}]

def test_quick_sale_catalog_blocks_reserved_animal(...):
    # animal con _create_animal (tests/test_animals.py), su producto con quick_sale=True, status RESERVED
    assert item["blocked_reason"] == "reserved" and item["animal"]["id"] == animal["id"]

def test_quick_sale_catalog_requires_sales_create(...):  # usuario sin sales.create → 403
```

(el cuerpo exacto de `bundle-items` según `BundleItemIn`)

- [ ] **Step 2:** correr → FAIL 404/422
- [ ] **Step 3:** Implementar `read_quick_sale(db)`; el stock con una sola consulta agrupada sobre `ProductBatch` para todos los ids (productos + componentes), no una por producto.
- [ ] **Step 4:** `poetry run pytest tests/test_quick_sale.py -v` → PASS
- [ ] **Step 5:** Commit `feat(ventas): catálogo de venta rápida en una petición`

### Task A3: `sold_at` en el checkout

**Files:**
- Modify: `src/pharmatrack/models/sales/schemas.py` (`SaleCheckout`), `src/pharmatrack/api/routes/sales.py` (`checkout`)
- Test: `tests/test_sales_checkout.py`

**Interfaces:**
- Produces: `SaleCheckout.sold_at: Optional[datetime] = None`. Con zona → se convierte a UTC sin zona. Más de 5 minutos en el futuro → 422. Si viene, `sale.date_sale = sold_at`.

- [ ] **Step 1: Pruebas que fallan** (con el helper de carga de `tests/test_sales_checkout.py`)

```python
def test_checkout_keeps_sold_at(...):
    res = client.post(URL, json={**body, "sold_at": "2026-11-22T18:30:00Z"}, headers=auth_headers)
    assert res.status_code == 201 and res.json()["date_sale"].startswith("2026-11-22T18:30:00")

def test_checkout_rejects_future_sold_at(...):
    future = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    assert client.post(URL, json={**body, "sold_at": future}, headers=auth_headers).status_code == 422

def test_checkout_without_sold_at_unchanged(...):   # date_sale ≈ ahora
```

- [ ] **Step 2-4:** FAIL → implementar (validador de campo + una línea en `checkout`) → `poetry run pytest tests/test_sales_checkout.py -v` PASS
- [ ] **Step 5:** Commit `feat(ventas): el checkout acepta la hora real de la venta`. Correr toda la suite: `poetry run pytest` → PASS.

---

## Fase 1 — Frontend

### Task F1: Matemática de la venta rápida

**Files:**
- Create: `src/sections/quick-sale/quick-sale-math.js`
- Test: `src/test/quick-sale/quick-sale-math.test.js`

**Interfaces:**
- Consumes: forma `QuickSaleItem` (A2). Una **línea** es `{ product_id, quantity, discount }` (descuento en pesos).
- Produces:

```js
lineTotals(item, quantity, discount = 0)   // → { subtotal, tax, total } (números con 2 decimales)
cartTotals(lines, itemsById)               // → { subtotal, discount, tax, total }
maxDiscount(item, quantity)                // → número | null (sin tope)
spreadDiscount(lines, itemsById, percent)  // → { lines, unapplied } reparte % por línea respetando topes
usage(sales)                               // → Map<product_id, cantidad> de ventas status 'pending'|'review', paquetes expandidos con sale.lines[].components
stockOf(item, usedMap)                     // → número | null (sin control). Paquete: min(floor((comp.stock − usado) / comp.quantity)) sobre componentes con stock no nulo
```

`stockOf` nunca devuelve negativo. Aritmética en centavos (`Math.round(x * 100)`).

- [ ] **Step 1: Pruebas que fallan**

```js
const cueva = { id: 1, price_retail: '80.00', tax_percentage: 16, max_discount: 10, stock: 8, is_bundle: false, components: [] };
const pack = { id: 2, price_retail: '200.00', tax_percentage: null, max_discount: null, stock: null, is_bundle: true, components: [{ product_id: 1, quantity: 3, stock: 8 }] };

it('total de línea igual al servidor', () => {
  expect(lineTotals(cueva, 2, 10)).toEqual({ subtotal: 150, tax: 24, total: 174 });
  expect(lineTotals({ ...cueva, price_retail: '0.10', tax_percentage: null }, 3)).toEqual({ subtotal: 0.3, tax: 0, total: 0.3 });
});
it('tope de descuento', () => {
  expect(maxDiscount(cueva, 2)).toBe(16);
  expect(maxDiscount(pack, 1)).toBeNull();
});
it('reparte el descuento y avisa lo que no cupo', () => {
  const r = spreadDiscount([{ product_id: 1, quantity: 1, discount: 0 }, { product_id: 2, quantity: 1, discount: 0 }], byId, 20);
  expect(r.lines.map((l) => l.discount)).toEqual([8, 40]);   // cueva topa en 10 % = 8
  expect(r.unapplied).toBe(8);                               // 20 % de 80 = 16, cupieron 8
});
it('stock derivado: descuenta ventas sin subir, también vía paquete', () => {
  const used = usage([{ status: 'pending', lines: [{ product_id: 2, quantity: 1, components: [{ product_id: 1, quantity: 3 }] }] },
                      { status: 'synced', lines: [{ product_id: 1, quantity: 5, components: [] }] }]);
  expect(stockOf(cueva, used)).toBe(5);
  expect(stockOf(pack, used)).toBe(1);
  expect(stockOf({ ...cueva, stock: null }, used)).toBeNull();
});
it('el stock nunca es negativo', () => expect(stockOf(cueva, new Map([[1, 99]]))).toBe(0));
```

- [ ] **Step 2-4:** `yarn test src/test/quick-sale/quick-sale-math.test.js --run` FAIL → implementar → PASS
- [ ] **Step 5:** Commit `feat(venta-rápida): cálculo de totales, descuentos y stock`

### Task F2: Almacén local y hook

**Files:**
- Create: `src/sections/quick-sale/quick-sale-store.js`, `src/sections/quick-sale/use-quick-sale.js`
- Modify: `src/lib/axios.js` (`endpoints.product.quickSale = '/api/v1/products/quick-sale'`, `toggleQuickSale: (id) => …`), `src/actions/product.js` (`toggleProductQuickSale(id)`, como `toggleProductOnline`), `package.json` (`yarn add -D fake-indexeddb`), `src/test/setup.js` (`import 'fake-indexeddb/auto'`)
- Test: `src/test/quick-sale/quick-sale-store.test.js`, `src/test/quick-sale/use-quick-sale.test.jsx`

**Interfaces:**
- Produces (store; base `quick-sale` v1, almacenes `kv` y `queue` con `keyPath: 'idempotency_key'`):

```js
getKV(key) / setKV(key, value)      // claves: 'catalog' {items, fetchedAt}, 'context', 'device' {id, counter}, 'prefs'
listSales()                          // → venta[] ordenadas por sold_at
putSale(sale)                        // inserta o reemplaza
addSale(sale)                        // inserta; si la llave ya existe NO reemplaza y devuelve false
nextFolio()                          // → 'VR-AB12-0007' (id de 4 caracteres creado una vez; consecutivo atómico)
```

Una **venta local**: `{ idempotency_key, folio, sold_at (ISO UTC), branch_id, lines: [{ product_id, title, quantity, discount, price_retail, tax_percentage, components, ticketItem }], payment: { method_payment, amount }, totals, status: 'pending'|'synced'|'review', reason?, sale_id?, server_total? }`.

- Produces (hook) `useQuickSale()` → `{ ready, items, stockOf(item), cart, add(item), setQuantity(productId, n), setDiscount(productId, pesos), discountAll(percent), clear(), totals, counts: { pending, review }, sales, reload() }`. `add` no pasa del stock ni agrega un bloqueado. `ready === false` mientras lee; `items === null` si no hay catálogo.

- [ ] **Step 1: Pruebas que fallan** — store: `nextFolio()` dos veces da consecutivos `…-0001`, `…-0002` con el mismo prefijo; `addSale` con llave repetida devuelve `false` y no cambia la venta; los datos sobreviven a reabrir la base. Hook (Review Focus 1): con catálogo `cueva.stock = 8` y una venta `pending` de 3 en la cola, `stockOf(cueva) === 5`; tras `setKV('catalog', …stock 8 otra vez)` + `reload()` sigue en 5; `add` 6 veces deja la cantidad en 5.
- [ ] **Step 2-4:** FAIL → implementar (IndexedDB directo, sin librería; el hook deriva el stock con `usage` + `stockOf` de F1) → PASS
- [ ] **Step 5:** Commit `feat(venta-rápida): almacén local y estado de la cuenta`

### Task F3: Pantalla de venta rápida (con internet)

**Files:**
- Create: `src/sections/quick-sale/{quick-sale-grid,quick-sale-cart,quick-sale-picker}.jsx`, `src/sections/quick-sale/view/quick-sale-view.jsx`, `src/pages/dashboard/quick-sale/index.jsx`
- Modify: `src/routes/paths.js` (`dashboard.quickSale = { root: '/dashboard/quick-sale', ticket: (key) => … }`), `src/routes/sections/dashboard.jsx` (ruta `quick-sale` con `guard(P.salesCreate…)`; usar la constante existente de `sales.create` o agregarla a `P`), `src/layouts/nav-config-dashboard.jsx` (entrada «Venta rápida» antes de «Nueva venta», `allowedRoles: ['sales.create']`), `src/sections/product/product-create-edit-form.jsx` (interruptor `quick_sale` junto a `show_online`)
- Test: `src/test/quick-sale/quick-sale-view.test.jsx`

**Interfaces:**
- Consumes: `useQuickSale` (F2), math (F1), `checkoutSale`, `useGetBranches`, `useGetProducts`, `toggleProductQuickSale`.
- Produces: la vista llama a una función `charge({ cart, method, received })` definida en la vista en esta tarea (envía `checkoutSale` directo con `idempotency_key: crypto.randomUUID()`); F6 la sustituye por `enqueueSale`. En esta tarea el catálogo se pide a `endpoints.product.quickSale` al montar y se guarda con `setKV('catalog', …)`.

Comportamiento (del spec): rejilla de botones grandes con foto, título, precio y «· N» de existencias, agrupados por categoría; apagado si `stockOf === 0` («Agotado») o `blocked_reason` (con el mismo texto que `scanBlockReason`); marca «Paquete». Cuenta a la derecha (abajo en pantallas angostas) con `[−][+]`, «Descuento» por línea (pesos o %, validado con `maxDiscount`), «Descuento a la cuenta» (`discountAll`, avisa `unapplied`), total, método único (Efectivo/Tarjeta/Transferencia), en efectivo «Recibí» → «Cambio», casilla «Imprimir ticket» (se guarda en `kv.prefs`), «Cobrar». Sucursal: selector discreto, última usada en `kv.prefs`. «+ Agregar productos»: diálogo con buscador sobre `useGetProducts` y un interruptor por resultado (`toggleProductQuickSale`), que recarga el catálogo al cerrar. Estilo con los componentes MUI del dashboard; objetivos táctiles ≥ 48 px.

- [ ] **Step 1: Pruebas que fallan** (MSW para `/products/quick-sale`, `/branches`, `/sales/checkout`): tocar un botón dos veces muestra `2×` y el total correcto; un producto agotado está deshabilitado; un descuento sobre el tope muestra el error y no se aplica; «Cobrar» manda `{ branch_id, items: [{ product_id, quantity, discount }], payments: [{ method_payment: 'cash', amount: total }], idempotency_key }` y vacía la cuenta.
- [ ] **Step 2-4:** FAIL → implementar → PASS; `yarn lint` limpio
- [ ] **Step 5:** Commit `feat(venta-rápida): pantalla de botones con cobro`

### Task F4: Ticket desde datos locales

**Files:**
- Modify: `src/sections/sale/sale-ticket.jsx` (si `ticket.folio` existe se imprime tal cual en lugar de `folio(id, prefix)`), `src/sections/sale/view/sale-ticket-view.jsx` (prop opcional `local = { ticket, business, settings }`: si viene, no se piden venta, negocio ni ajuste; «volver» va a la venta rápida y, tras `afterprint`, regresa sola), `src/sections/sale/print-ticket.js` (exportar `toItem`)
- Create: `src/sections/quick-sale/view/quick-sale-ticket-view.jsx`, `src/pages/dashboard/quick-sale/ticket.jsx`; ruta `dashboard/quick-sale/ticket/:key` fuera del layout, junto a las de ticket existentes en `dashboard.jsx`
- Test: `src/test/quick-sale/quick-sale-ticket.test.jsx`, y que `src/test/sale/*.test.jsx` sigan pasando

**Interfaces:**
- Consumes: `listSales`/`getKV('context')` (F2); `toItem(detail, product, animal)`.
- Produces: `buildTicketItem(item, quantity)` en `quick-sale-ticket-view.jsx` (usa `toItem` con `item.animal`) — F3/F6 lo guardan en `line.ticketItem` al cobrar. La vista arma `{ folio, fecha: sold_at, items, descuento, impuestos, total, metodo_pago, pagado }` desde la venta local.

- [ ] **Step 1: Pruebas que fallan:** con una venta local en la cola y `context` guardado, la ruta pinta el folio `VR-…`, las líneas, el descuento y el total **sin ninguna petición de red** (MSW `onUnhandledRequest: 'error'`).
- [ ] **Step 2-4:** FAIL → implementar; en F3, `charge` navega a `paths.dashboard.quickSale.ticket(key) + '?print=1'` cuando «Imprimir ticket» está marcado → PASS
- [ ] **Step 5:** Commit `feat(venta-rápida): ticket impreso con datos locales`
- [ ] **Step 6: Verificación de fase 1 en la app real** — API y frontend locales: marcar 3 productos y un paquete, vender con descuento, imprimir «prueba» en la térmica, revisar la venta en Ventas (total, hora, stock). Fase 1 queda desplegable.

---

## Fase 2 — Sin internet

### Task F5: Preparar

**Files:**
- Create: `src/sections/quick-sale/quick-sale-sync.js`, `src/sections/quick-sale/quick-sale-status.jsx`
- Test: `src/test/quick-sale/quick-sale-sync.test.js`

**Interfaces:**
- Produces: `prepareOffline({ branchId, user })` → `{ count, fetchedAt }`. Descarga en paralelo `endpoints.product.quickSale`, `BUSINESS_URL` y `/api/v1/settings/ticket-print`; guarda `catalog` y `context = { business, ticketSettings, branchId, user: { id, email, role, permissions, displayName } }`; hace `fetch` de cada `item.image` (para que el service worker la guarde; un fallo de imagen no aborta); llama `navigator.storage?.persist?.()`; borra ventas `synced` de más de 7 días. Si falla el catálogo, no toca lo ya guardado y lanza el error.
- `QuickSaleStatus`: barra con «Listo · N productos · preparado hoy 9:14» / «Sin preparar», botón «Preparar para vender sin internet», indicador «Sin conexión», contador «N por subir · M por revisar».

- [ ] **Step 1: Pruebas que fallan:** tras `prepareOffline`, `getKV('catalog').items` y `getKV('context').business` tienen lo que devolvió MSW; si `/products/quick-sale` responde 500, el catálogo anterior sigue intacto y la promesa rechaza; una imagen que falla no rechaza.
- [ ] **Step 2-4:** FAIL → implementar; la vista deja de pedir el catálogo por su cuenta: con red llama a `prepareOffline` al montar → PASS
- [ ] **Step 5:** Commit `feat(venta-rápida): preparar el dispositivo para vender sin internet`

### Task F6: Cola y sincronización

**Files:**
- Modify: `src/sections/quick-sale/quick-sale-sync.js`, `view/quick-sale-view.jsx`, `quick-sale-status.jsx`
- Test: `src/test/quick-sale/quick-sale-sync.test.js`, `src/test/quick-sale/quick-sale-view.test.jsx`

**Interfaces:**
- Produces:

```js
enqueueSale({ key, cart, itemsById, method, branchId })  // → venta local 'pending' (folio de nextFolio, sold_at = ahora UTC). `key` lo crea la vista al abrir la cuenta; usa addSale: misma key dos veces = una venta
syncQueue()   // una sola corrida a la vez; envía en orden cada 'pending' a checkoutSale; → { synced, review, pending }
retrySale(key)        // 'review' → 'pending' y corre syncQueue
exportBackup()        // descarga 'ventas-pendientes-<fecha>.json' con todas las ventas no 'synced'
```

Reglas de `syncQueue` por venta (el error de axios trae `status`; sin `status` = sin red):

| Resultado | Estado |
|---|---|
| 201 y `abs(res.total − totals.total) < 0.01` | `synced`, guarda `sale_id` |
| 201 y total distinto | `review`, `reason: 'Se cobró $X; el sistema registró $Y'`, guarda `sale_id` y `server_total` (no se reenvía) |
| 400 / 404 / 422 | `review` con el `message` del servidor |
| 401 / 403 | queda `pending`, se detiene la corrida, devuelve `needsLogin: true` |
| sin red / 5xx / 429 | queda `pending`, se detiene la corrida |

El cuerpo enviado: `{ branch_id, description: 'Venta rápida · <folio>', items, payments: [{ method_payment, amount: totals.total }], idempotency_key, sold_at }`. `retrySale` sobre una venta con `sale_id` solo la marca `synced` (ya existe en el servidor; el dueño aceptó la diferencia).

Disparadores: evento `online`, montar la vista, después de cada cobro y botón «Subir ahora». La vista sustituye el `charge` de F3 por `enqueueSale` + `syncQueue()` sin esperar. Lista «Por revisar» con motivo y «Reintentar»; botón «Descargar respaldo»; aviso fijo mientras haya pendientes: «Hay ventas sin subir. No borres los datos del navegador.»

- [ ] **Step 1: Pruebas que fallan:** cada fila de la tabla; **Review Focus 2**: dos `enqueueSale` con la misma `key` dejan una venta; **Review Focus 3**: el handler de MSW registra la venta pero responde error de red la primera vez y 201 con la misma venta la segunda → una sola venta en el servidor simulado, estado `synced`; dos `syncQueue()` simultáneos envían cada venta una vez; con 401 las ventas siguen `pending`.
- [ ] **Step 2-4:** FAIL → implementar → PASS
- [ ] **Step 5:** Commit `feat(venta-rápida): cola de ventas y subida automática`

### Task F7: Service worker

**Files:**
- Modify: `package.json` (`yarn add -D vite-plugin-pwa`), `vite.config.js`, `src/main.jsx` (registro), `public/brand/assets/favicon/site.webmanifest` y `public/brand/vetpatitas/favicon/site.webmanifest` (`"start_url": "/"`, `"id": "/"`), `CLAUDE.md` (sección corta «Venta rápida sin internet»: cómo probar con `yarn build && yarn preview`)
- Test: `src/test/quick-sale/quick-sale-view.test.jsx`

Leer primero la documentación actual de `vite-plugin-pwa` (opciones `manifest: false`, `registerType`, `workbox`). Requisitos:

- `manifest: false` (se conserva el `<link rel="manifest">` por marca).
- Precarga de todo el build (`js, css, html, svg, png, ico, woff2`; subir `maximumFileSizeToCacheInBytes` si algún chunk lo excede), `navigateFallback: '/index.html'`.
- Caché en ejecución `CacheFirst` para `https://res.cloudinary.com/` (caché `product-images`, máx. 500 entradas, acepta respuestas 0 y 200).
- Las llamadas al API **no** se cachean.
- Una versión nueva se activa en la siguiente apertura; la página **no** se recarga sola.
- Desactivado en `yarn dev`.

- [ ] **Step 1: Prueba que falla (Review Focus 5):** con el almacén vacío y `/products/quick-sale` respondiendo error de red, la vista muestra «Prepara la venta rápida con internet antes de salir» y ningún botón de producto.
- [ ] **Step 2-3:** FAIL → implementar el estado vacío y la configuración → PASS
- [ ] **Step 4: Verificación manual** — `yarn build && yarn preview`; en Chrome: instalar la app, DevTools → Application → Service Workers activo; preparar; Network → Offline; recargar: la venta rápida abre con fotos.
- [ ] **Step 5:** Commit `feat(pwa): la app se instala y abre sin internet`

### Task F8: Sesión sin red

**Files:**
- Modify: `src/auth/context/jwt/utils.js` (`scheduleTokenRefresh`), `src/auth/context/jwt/auth-provider.jsx` (`checkUserSession`)
- Test: `src/test/auth/offline-session.test.jsx`

**Interfaces:**
- Consumes: `getKV('context').user` (F5).
- Produces: `user.offline === true` cuando la sesión viene del contexto guardado.

Reglas:
- `scheduleTokenRefresh`: si `doRefresh` falla **sin `status`** (sin red), no se cierra la sesión ni se redirige; se reintenta al evento `online` (una vez). Con `status` (401, etc.) se comporta como hoy.
- `checkUserSession`: si no hay token válido y la renovación falla sin `status` (o no hay red) y existe `context.user`, se entra con ese usuario y `offline: true`. Sin `context.user`, como hoy.
- Al evento `online` con `user.offline`, se vuelve a correr `checkUserSession`; si la renovación responde 401, la venta rápida sigue abierta y `syncQueue` devuelve `needsLogin` → la barra muestra «Inicia sesión para subir las ventas» con enlace al login (`returnTo` a la venta rápida).
- Cerrar sesión a mano borra `context.user`.

- [ ] **Step 1: Pruebas que fallan:** **Review Focus 4**: con temporizadores falsos, token que caduca y `/auth/refresh` con error de red, `window.location.href` no cambia y el token no se borra; con `/auth/refresh` 401 sí se cierra (como hoy). Arranque sin token + error de red + `context.user` guardado → `authenticated === true`, `user.offline === true`. Arranque sin token y sin contexto → no autenticado.
- [ ] **Step 2-4:** FAIL → implementar → `yarn test src/test/auth --run` PASS (incluida `sign-in.test.jsx`)
- [ ] **Step 5:** Commit `feat(auth): la sesión no se cierra por falta de internet`

### Task F9: Cierre

- [ ] **Step 1:** `yarn test --run` y `yarn lint` en el frontend; `poetry run pytest` en el API → todo PASS.
- [ ] **Step 2: Ensayo local sin red** — `yarn build && yarn preview` contra el API local: preparar → Offline → cerrar y reabrir → 5 ventas con ticket (un ejemplar único, una que agote, una con descuento, un paquete) → vender el mismo ejemplar desde la venta normal en otra pestaña con red → reconectar → 4 `synced`, 1 «por revisar» con el motivo del servidor; stock y resumen de ventas cuadran; «Descargar respaldo» baja el JSON.
- [ ] **Step 3:** Entregar al dueño el guion del ensayo del día 6 (spec, «Fase 3») para repetirlo en producción y en una segunda laptop. No hacer push ni desplegar sin que el dueño lo pida.
