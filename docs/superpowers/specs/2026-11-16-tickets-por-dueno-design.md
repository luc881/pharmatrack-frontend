# Un ticket por dueño en la venta rápida (Opuntia Den y BD Exóticos)

## Para qué

En la convención del 22 de noviembre Opuntia Den comparte stand con BD Exóticos. Se cobra
desde la misma venta rápida, pero cada marca entrega su propio ticket: su logo, sus datos, sus
productos, su folio y su total. Los slushies son de BD.

## Decisiones del dueño

- El dueño se marca **en el producto**, una vez (campo «Proveedor dueño», ya existe), y
  también se puede marcar **desde la venta rápida** al agregar productos. Nunca por venta.
- Los slushies son de BD: van en el ticket de BD, más el talón de orden de siempre.
- No inventar datos de contacto de BD: lo que no esté en su ficha de proveedor no se imprime.

## Cómo funciona

1. **Un solo cobro.** Al cobrar, la venta se separa por dueño (`consignor_id` de cada
   producto; vacío = Opuntia). Sale un ticket por dueño, uno detrás de otro, con corte entre
   ellos, y después el talón de orden si hay algo que preparar.
2. **Folios por marca.** Cada ticket lleva su folio con el prefijo de su marca y su propio
   contador en el equipo: `OD-…` (prefijo de «Datos del negocio») y `BD-…` (prefijo del
   proveedor). Se asignan al cobrar, también sin internet.
3. **Totales por ticket.** Cada ticket muestra sus productos, su subtotal y total, y el
   método de pago. El efectivo recibido y el cambio se muestran en la pantalla de cobro; en el
   ticket, «Pagado» es el total de ese ticket.
4. **En el sistema** la venta sigue siendo una sola (sus renglones ya saben de quién son), y
   el Corte de caja ya la reparte por dueño («Por dueño»). Guardar la venta en el equipo y
   subirla después no cambia.
5. **El ticket de Opuntia queda igual al de hoy.** El de BD usa el mismo diseño con los datos
   de su ficha de proveedor.

## Proveedor (BD Exóticos)

- Solo el nombre es obligatorio (no hace falta correo).
- Logo: botón para **subirlo** (además de pegar link, que se copia a Cloudinary). Se usa
  `bd-logo-58mm.png`/`bd-logo.svg` del paquete de la marca; ancho en ticket: 26 mm en 58 mm y
  30 mm en 80 mm (es vertical).
- **Cambio de base de datos** (columnas nuevas en `suppliers`, todas opcionales):
  `ticket_prefix` (ej. `BD`), `ticket_lines` (líneas de contacto, una por renglón),
  `ticket_qr_url` (si falta, sin QR).

## Marcar el dueño desde la venta rápida

- En «+ Agregar productos» → Productos, cada producto muestra su dueño y se cambia ahí mismo.
- «Producto temporal» ya pide el dueño.

## Fuera de esto

- Pedidos del sitio y ventas del dashboard normal: siguen con un ticket (no se mezclan dueños
  ahí todavía).
- Separar la venta en varias ventas del sistema: no hace falta para el corte y arriesga la
  subida sin internet a días de la convención.
