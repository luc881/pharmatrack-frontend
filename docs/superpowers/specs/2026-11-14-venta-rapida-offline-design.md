# Venta rápida y venta sin internet (PWA)

Fecha: 2026-11-14 · Repos: `pharmatrack-frontend` (la mayor parte) y `pharmatrack-api`

## Para qué

El dueño vende en convenciones: mucha gente, ruido, internet malo o nulo. Hoy la
venta agrega productos por escáner (SKU) o buscador, y no es práctico etiquetar
cada bote. Además puede llevar una laptop distinta a la suya, sin git ni
Postgres, así que instalar el sistema local en cada equipo no sirve.

La próxima convención es el **2026-11-22**. Se quiere una solución que quede
para los siguientes eventos y que a futuro no obligue a pausar el sitio.

## Metas

1. Una pantalla de **venta rápida**: botones grandes con solo los productos
   marcados; un toque suma uno; se cobra y sale el ticket.
2. Esa pantalla **funciona sin internet** en cualquier laptop con Chrome o Edge:
   se prepara antes de salir, vende offline y sube las ventas sola al reconectar.
3. Ninguna venta cobrada se pierde ni se duplica.

## Fuera de alcance

- El resto del dashboard sin internet (sigue necesitando conexión).
- Pagos mixtos, devoluciones y edición de ventas desde la venta rápida: para eso
  está la venta normal.
- Un motor de promociones automáticas («3 por $X» que se aplique solo). Una
  promoción así se arma como paquete (ver «Paquetes y descuentos»).
- Orden manual de los botones (van por categoría y nombre).
- Stock compartido entre dos dispositivos offline: cada uno descuenta por su
  lado hasta sincronizar.
- Interruptor para pausar pedidos del sitio. Solo haría falta si el ensayo falla
  y se usa el modo convención; se decide ese día.
- Impresión desde iPad (la térmica POS-5890A-L es USB con driver de Windows).

## Lo que haría de esto un fracaso

- Una venta cobrada que no llega a producción, o que llega dos veces.
- Que el total del ticket no coincida con el que registra el servidor sin que
  nadie se entere.
- Que la pantalla saque al usuario al login a media convención.
- Que una actualización de la app borre la cola de ventas.

## Caminos considerados

| Camino | Costo | Por qué sí / no |
|---|---|---|
| **PWA limitada a venta rápida, con el modo convención de respaldo** (elegido por el dueño) | Mediano | Sirve en cualquier laptop, no pausa el sitio, sincroniza sola |
| Instalador del sistema local para otras laptops | Mediano | Sigue necesitando `sync-up` (reemplaza producción) y pausar el sitio |
| Solo modo convención (`sync-down/up.ps1`) | Nulo | Ata al dueño a su laptop; borra pedidos web hechos durante el evento |

## Cómo está hoy (lo que se reutiliza)

- `POST /api/v1/sales/checkout` (`pharmatrack-api/src/pharmatrack/api/routes/sales.py`)
  ya es atómico e **idempotente**: `idempotency_key` (8-64 caracteres, índice
  único en `sales`). Repetir la petición devuelve la misma venta. El precio lo
  resuelve el servidor (`build_sale_detail`, `recalc_sale_totals`); el cliente
  solo manda `product_id`, `quantity`, `discount`.
- `checkoutSale` en `src/actions/sale.js`.
- `SaleTicket({ ticket, business, width })` en `src/sections/sale/sale-ticket.jsx`
  recibe objetos planos: se puede pintar con datos locales. El ajuste de
  impresora viene de `/api/v1/settings/ticket-print` y los datos del negocio de
  `useTicketTemplate`.
- Bandera `show_online` en producto: mismo patrón para la bandera nueva (ORM,
  schemas, `product-create-edit-form.jsx`).
- Cada animal en venta tiene un producto gemelo con existencias en lotes, así
  que la bandera en `products` cubre animales, paquetes e insumos.
- `useBlockedAnimalProducts` / `scanBlockReason` en `sale-create-edit-form.jsx`:
  reglas de qué animal no se puede vender (reservado, muerto, no en venta).
- `public/brand/<cliente>/favicon/site.webmanifest` ya existe por instalación.
- No hay service worker ni almacenamiento local de datos.

## Diseño

### Fase 1 — Venta rápida con internet (días 1-2)

**API**

- `products.quick_sale` (boolean, default false) + migración; en los schemas de
  crear, actualizar y respuesta.
- `GET /api/v1/products/quick-sale` (permiso `sales.create`): una sola petición
  con todo lo que la pantalla necesita por producto marcado y activo: `id`,
  `title`, `image`, categoría, y lo necesario para calcular el total igual que el
  servidor (`price_retail` y `tax_percentage`; el POS no aplica las escalas por
  cantidad de la tienda en línea, y la venta rápida tampoco),
  `stock` (suma de lotes; para paquetes, el derivado de sus componentes) y
  `blocked_reason` si es un animal que no se puede vender.
- `SaleCheckout.sold_at` opcional: si viene, es la fecha de la venta (para que
  una venta subida horas después quede en su hora real). Sin él, todo igual.

**Pantalla** — ruta `dashboard/quick-sale`, permiso de crear ventas, entrada
«Venta rápida» visible en el menú de ventas.

```
┌────────┐ ┌────────┐ ┌────────┐   Cuenta
│ foto   │ │ foto   │ │ foto   │   2× Isópodo dairy  $300   [−][+]
│ Dairy  │ │Sustrato│ │ Musgo  │   1× Sustrato        $80   [−][+]
│ $150·8 │ │ $80·12 │ │ agotado│   ─────────────────────────
└────────┘ └────────┘ └────────┘   Total  $380
  toque = +1 (· = quedan)          (Efectivo) (Tarjeta) (Transf.)
[+ Agregar productos]              Recibí: [ 500 ]  Cambio: $120
                                   [        COBRAR        ]
```

- Un toque suma 1; el botón muestra precio y existencias, y se apaga al agotarse
  o si el animal está bloqueado.
- Un solo método de pago por venta. En efectivo, campo «Recibí» que calcula el
  cambio (no se guarda).
- «Cobrar» llama a `checkoutSale` con una `idempotency_key` nueva por venta, abre
  el ticket para imprimir y deja la cuenta vacía para la siguiente.
- Sucursal: la última usada (o la única); se cambia desde un selector discreto.
- **«+ Agregar productos»** abre un buscador para marcar o desmarcar cualquier
  producto (incluidos los gemelos de animales) sin salir de la pantalla. Además,
  interruptor «Venta rápida» en el formulario de producto, junto a «Mostrar en
  el sitio».

**Paquetes y descuentos** (pedidos por el dueño el 2026-11-14; en esta
convención no hay promociones, pero deben quedar listos)

- **Paquetes.** Ya existen: un paquete es un producto con `bundle_items`, sin
  stock propio, y venderlo descuenta sus componentes. Marcado como venta rápida
  aparece como un botón más, con una marca «Paquete». Su disponibilidad es la
  de sus componentes; al tocarlo, el stock local de cada componente baja y los
  botones de esos componentes se actualizan (y al revés). Una promoción «3 por
  $X» se da de alta como paquete con ese precio. El endpoint `quick-sale`
  devuelve los componentes y cantidades de cada paquete para poder hacer esa
  cuenta sin red.
- **Descuento por línea.** Cada línea de la cuenta tiene un botón «Descuento»:
  se escribe en pesos o en porcentaje y se manda como `discount` (monto) en el
  checkout, que ya lo soporta. Se valida en el dispositivo con la misma regla
  que `_check_max_discount`: el monto no puede pasar de
  `price_retail × cantidad × max_discount / 100`; sin `max_discount` no hay
  tope. El endpoint `quick-sale` incluye `max_discount`. El impuesto se calcula
  sobre el subtotal ya descontado, igual que el servidor.
- **Descuento a toda la cuenta.** Un botón «Descuento a la cuenta» reparte un
  porcentaje entre las líneas (cada una respeta su tope; si alguna no alcanza,
  se avisa cuánto quedó sin aplicar). No hay descuento a nivel venta en el API;
  no se agrega.
- El ticket muestra el descuento de cada línea.

### Fase 2 — Sin internet (días 3-5)

**Instalable.** Service worker con `vite-plugin-pwa` (única dependencia nueva):
precarga la app completa para que abra sin red. El manifest sigue saliendo de
`VITE_BRAND_DIR`. Una actualización nunca toca los datos guardados.

**Datos en el dispositivo** (IndexedDB, detrás de un módulo chico propio para
poder probarlo; pedir `navigator.storage.persist()`):

- `catalog`: la respuesta de `/products/quick-sale` + fecha de descarga.
- `context`: datos del negocio, ajuste de impresora, sucursal y usuario.
- `queue`: ventas pendientes. Cada una: `idempotency_key`, folio local, líneas
  con el precio cobrado, pago, total, `sold_at`, estado (`pendiente`, `subida`,
  `por revisar` + motivo).

**Preparar.** Botón «Preparar para vender sin internet»: descarga catálogo,
contexto y las fotos de los botones (caché del service worker para
`res.cloudinary.com`). Muestra «Listo · N productos · preparado hoy 9:14». Con
conexión, la pantalla vuelve a descargar el catálogo sola al abrirse.

**Vender.** La pantalla siempre lee del catálogo local y siempre encola: una
sola ruta de código con o sin red. Al cobrar: guarda la venta en `queue`,
descuenta el stock local e imprime el ticket con los datos locales. Si hay red,
la cola se vacía de inmediato.

**Folio.** Sin red no hay id de venta. El ticket lleva un folio local
(`VR-<4 caracteres del dispositivo>-<consecutivo>`), que viaja en
`description` de la venta para poder encontrarla después.

**Sincronizar.** Al volver la red (evento `online`, al abrir la pantalla y con
un botón «Subir ahora»), se envía cada venta pendiente, en orden, a
`/sales/checkout`:

- 201 y el total del servidor coincide → `subida`.
- 201 y el total difiere (cambió un precio) → `por revisar`: «se cobró $X, el
  sistema registró $Y».
- 400 (sin stock, animal reservado, etc.) → `por revisar` con el motivo del
  servidor y botón «Reintentar» para después de corregirlo en el dashboard.
- 401 o sin red → se queda `pendiente`; se reintenta al tener sesión.

La pantalla muestra siempre un contador: «3 por subir · 1 por revisar».

**Sesión.** Si no hay red y el token caducó, la venta rápida abre igual con el
usuario guardado en `context` (solo datos locales). Subir ventas sí exige sesión
válida: con «Recordarme» se renueva sola al reconectar; sin eso, pide entrar.

**Respaldo.** Botón «Descargar respaldo» que baja la cola a un archivo JSON.
Borrar los datos del sitio en el navegador borraría las ventas sin subir; la
pantalla lo advierte mientras haya pendientes.

### Fase 3 — Ensayo (día 6) y plan B

Guion: preparar → apagar wifi → cerrar y reabrir la app → 5 ventas con ticket
(una de un ejemplar único, una que agote un producto) → vender el mismo ejemplar
en producción desde otro equipo → reconectar → revisar que entraron 4, que 1
quedó «por revisar», y que el stock y el resumen de ventas cuadran. Repetir en
una segunda laptop sin nada instalado.

Si falla: modo convención en la laptop del dueño (`sync-down.ps1` + launcher),
con la venta rápida de la fase 1 corriendo en local.

## Restricciones

- El cálculo local del total debe dar lo mismo que `build_sale_detail` +
  `recalc_sale_totals`: por línea, `price_retail × cantidad − descuento`, más
  `tax_percentage` sobre ese subtotal; el total es la suma. La
  comparación al sincronizar es la red de seguridad, no el mecanismo.
- No se crea una ruta de stock negativo: los lotes no lo soportan.
- Preferencias por cuenta van en `app_settings`, no en `localStorage`.
- Nada de esto cambia la venta normal ni el modo convención.
- Multi-instalación: sin nombres de marca fijos; todo sale de las variables de
  entorno y de «Datos del negocio».

## Pruebas

- API (pytest): bandera, endpoint `quick-sale` (stock, bloqueados, paquetes),
  `sold_at`.
- Frontend (Vitest + MSW): cálculo del total contra casos del servidor (con
  descuento, con impuesto, tope de descuento); stock local de paquetes y
  componentes; cola y
  sincronización (éxito, reintento sin duplicar, 400 → por revisar, total
  distinto, 401); la pantalla abre con el catálogo local cuando la red falla.

## Queda a criterio de quien lo construya

Estructura de archivos dentro de `src/sections/quick-sale/`, forma exacta del
JSON del endpoint, envoltorio de IndexedDB, estrategia de caché del service
worker y el aspecto fino de la pantalla (con el sistema de diseño del dashboard).
