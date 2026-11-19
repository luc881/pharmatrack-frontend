# Descuento en bloque (porcentaje)

**Para qué:** bajar el precio de varios animales o productos a la vez para una
promoción, con el precio de antes tachado en la tienda y bien marcado en el
dashboard.

**Decidido con el usuario**
- Seleccionar varios en Animales → En venta y en Productos → «Descuento (N)».
- Solo porcentaje (−20% a cada uno según su precio).
- Al aplicar: el precio anterior queda en `compare_at_price` (tachado) y baja
  `price` / `price_retail`. Sitio, venta rápida y ticket cobran el precio nuevo.
- «Quitar descuento» regresa a cada uno a su precio anterior.
- En las listas: precio, el anterior tachado y una etiqueta «−20%».

**Mis decisiones**
- Sin acumular: si ya tenía oferta, el % se calcula sobre el precio anterior.
- Redondeo a pesos enteros; si el redondeo deja el mismo precio, ese se salta
  (el API exige tachado > precio).
- Porcentaje de 1 a 90.
- Sin cambios en el API (los PUT ya aceptan precio y tachado parciales).
- Sin fecha de fin (cambio aparte si se pide). Los precios por cantidad de la
  especie no se tocan.

**Approaches:** (a) botón en las listas que llama al PUT existente de cada uno
en tandas de 5 — elegido, sin migración; (b) endpoint de descuento en bloque
en el API — atómico pero más código para decenas de registros; (c) campañas
con fecha de fin — más grande de lo pedido.
