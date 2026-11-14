# Venta rápida: productos provisionales, órdenes de preparación y corte por dueño

Fecha: 2026-11-14 · Evento: convención del 2026-11-22 · Continúa
`2026-11-14-venta-rapida-offline-design.md`.

## Para qué

En la convención el dueño vende también lo de otro expositor que lo invitó, no
sabe con certeza qué va a traer cada quien, y además llevan una máquina de
slushies. Hoy la venta rápida solo vende productos dados de alta con internet.
Hacen falta tres cosas, todas sin red y reutilizables en eventos futuros:

1. Vender algo que nadie dio de alta, sin papel, y decidir después si se queda.
2. Cobrar algo que se prepara y se entrega después (slushies): ticket para el
   cliente y talón de orden para quien prepara.
3. Saber al final cuánto vendió cada dueño aunque sus productos se mezclen en
   un mismo ticket.

## Metas / no metas / anti-metas

- Metas: cada cosa nueva es un toque más, no una pantalla más; todo funciona
  sin internet; nada de esto es exclusivo de esta convención.
- No metas: variantes de producto (sabor/tamaño como opciones), lista en
  pantalla de «por entregar», reparto exacto por forma de pago, control de
  stock de provisionales, corte por dueño sin internet.
- Anti-metas: que un provisional permita cambiar el precio de un producto
  formal; que una venta cobrada se pierda porque su producto provisional no
  pudo crearse; que el talón obligue a tocar algo extra al cobrar.

## Enfoques considerados

Producto de último momento:
- **Provisional = producto real marcado (elegido).** El equipo lo crea local;
  al sincronizar se crea en el servidor con `provisional = true` y luego suben
  sus ventas apuntando a él. Ventas, reportes y devoluciones no cambian.
- Comodín «Artículo vario» con precio abierto: descartado; no deja un botón
  reutilizable ni nada que revisar después, y abre precios escritos a mano.
- Líneas de venta sin producto: descartado; toca reportes, ticket y
  devoluciones que dan por hecho el producto.

Slushies:
- **Seis productos normales en una categoría «Slushies» + marca «se prepara»
  (elegido).** Un toque por vaso; el reporte por sabor sale solo.
- Producto con opciones (tamaño → sabor): descartado; tres toques por vaso y
  un modelo de variantes que hoy nadie más necesita.

Dueño:
- **`consignor_id` en el producto → `suppliers` (elegido, decisión mía).** El
  otro expositor es un proveedor en consigna; ya hay tabla, alta y selector.
  `null` = propio.
- Reusar la marca del producto: descartado; la marca significa otra cosa.

## Diseño

### 1. Productos provisionales

API (`pharmatrack-api`):
- `products.provisional` boolean, default false. `products.client_key`
  (string 64, único, nullable): la llave que le puso el equipo.
- `POST /products/provisional` (permiso `sales.create`): `{client_key, title,
  price_retail, consignor_id?}`. Idempotente por `client_key` (repetir
  devuelve el mismo). Crea el producto con `provisional = true`,
  `quick_sale = true`, `tracks_batches = false`, `price_cost = 0`,
  `unit_name = "pieza"`, sin categoría obligatoria (usa/crea la categoría
  «De último momento»), `show_online = false`.
- `GET /products?provisional=true` para la página de revisión, con unidades
  vendidas e importe por producto.
- Conservar = `PUT /products/{id}` normal con `provisional = false`.
  Desechar = desactivar (`is_active = false`, `quick_sale = false`); sus
  ventas quedan con su nombre.
- `GET /products/quick-sale` incluye los provisionales activos, con
  `provisional` y `client_key` en cada item.

Dashboard:
- En la venta rápida, «+ Producto nuevo» (siempre habilitado, también sin
  red): nombre, precio y «de quién es». Se guarda en IndexedDB (`kv:
  'provisionals'`) con un `client_key` (UUID) y aparece como botón bajo «De
  último momento». Se puede corregir nombre/precio mientras no tenga ventas.
- En la cuenta y en la venta local su `product_id` es `local:<client_key>`.
- `syncQueue`: antes de subir ventas, crea en el servidor los provisionales
  que aún no tienen id (mismo manejo de errores que una venta). Al subir una
  venta, sus líneas `local:` se cambian por el id real. Si el provisional no
  pudo crearse, esa venta se queda pendiente y las demás siguen.
- Al bajar el catálogo, un provisional que ya viene del servidor (mismo
  `client_key`) deja de mostrarse dos veces.
- Página «Productos por revisar» (`/dashboard/product/provisional`, permiso
  `products.update`, entrada en el menú de Productos): lista con vendido e
  importe; «Completar y conservar» abre el formulario de producto;
  «Desechar» pide confirmación.

### 2. Órdenes de preparación

- `products.needs_prep` boolean («Se prepara al momento»), interruptor en el
  formulario de producto y campo en el catálogo de venta rápida. Los
  provisionales pueden marcarlo al crearse.
- La venta local guarda `needs_prep` en cada línea.
- Página de ticket de la venta rápida: si alguna línea es `needs_prep`,
  después del ticket del cliente va un salto de página y el talón «ORDEN»:
  folio, hora y solo las líneas que se preparan, `cantidad × nombre` en
  letra grande. Sin precios ni datos del negocio.
- Corte: lo hace el driver de la impresora configurado en «cortar por
  página». Sin cortador, sale todo seguido y se corta a mano por la línea.
- El talón se imprime aunque «Imprimir ticket» esté apagado (sin talón no hay
  orden): en ese caso solo sale el talón.
- Slushies: seis productos dados de alta por el dueño (limón, mango, mora ×
  $50 y $100), categoría «Slushies», `quick_sale`, `needs_prep`, sin stock.

### 3. Corte por dueño

- `products.consignor_id` nullable → `suppliers.id`. Selector «De quién es»
  (Propio / proveedor) en el formulario de producto y en «+ Producto nuevo»
  (los proveedores se guardan en el equipo al «Preparar»). El otro expositor
  se da de alta como proveedor antes de salir; sin red no se crean dueños.
- `GET /sales/report/by-owner?date_from&date_to&branch_id?` (permiso
  `sales.read`): por dueño, unidades e importe (total de línea, ya con su
  descuento e impuesto) de ventas completadas, con desglose por producto.
  Los paquetes cuentan para el dueño del paquete.
- Página «Corte por dueño» en Ventas: rango de fechas (hoy por omisión),
  tarjeta por dueño con su total y tabla por producto; botón imprimir.
- No reparte por forma de pago: en un ticket mezclado un solo pago cubre a
  los dos.

### 4. Buscador

Campo «Buscar producto» arriba de los botones de la venta rápida: filtra por
nombre y categoría (sin distinguir mayúsculas ni acentos) sobre lo guardado en
el equipo. Si no hay resultados ofrece «+ Producto nuevo» con ese nombre. Se
limpia al cobrar.

## Restricciones

- Mismo esquema que la venta rápida: la pantalla lee de IndexedDB y cobra
  contra la cola local; subir es aparte e idempotente.
- Sin iconos de Iconify en la pantalla de venta rápida.
- El total local debe seguir igualando al del servidor: el precio del
  provisional es el del producto creado, no viaja en la venta.
- Migraciones Alembic que corren solas al arrancar; desplegar API primero.
- Respuestas y textos en español; `yarn`; TDD.

## Lo que queda al constructor

- Nombres internos, forma exacta del desglose del reporte, estilos del talón
  (dentro del CSS del ticket: solo negro, 58/80 mm).
- Cómo migrar el almacén local sin perder ventas ya guardadas (IndexedDB v1).

## Decisiones mías (revísalas)

- Dueño = proveedor (`suppliers`), no una tabla nueva.
- El precio de un provisional no se cambia una vez que tiene ventas; para
  otro precio se crea otro o se usa descuento.
- El corte por dueño necesita internet (sale del servidor, tras subir).
- Con «Imprimir ticket» apagado, el talón de orden se imprime de todos modos.
