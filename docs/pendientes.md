# Pendientes

Ideas acordadas que todavía no se hacen. Cuando se tome una, se pasa a un
plan (`docs/superpowers/plans/`) y se borra de aquí.

## Canales de venta: tienda en línea y venta rápida (convenciones)

Contexto (2026-11-15): hay **un solo inventario**. Cada ejemplar en venta tiene
dos interruptores independientes, `show_public` (se anuncia en la tienda) y
`quick_sale` (es botón de la venta rápida). Ya existe: ver y filtrar por canal en
Animales → «En venta», cambiarlos en bloque con «Canales (N)», y dar de alta
desde la venta rápida con «+ Animal nuevo». Se decidió no separar inventarios
para no vender dos veces lo mismo.

### 1. Apartar parte de una cepa o paquete para la convención

- **Para qué:** de 30 isópodos en venta, llevar 10 a la expo sin que la tienda en
  línea los venda mientras tanto.
- **Hoy no se puede:** el API rechaza dos registros de la misma especie y
  variedad con el mismo destino (`find_bulk_sibling`, `BULK_DUPLICATE_MSG` en
  `pharmatrack-api/src/pharmatrack/api/routes/animals.py`).
- **Idea:** permitir dos registros cuando difieren en canal (uno solo tienda,
  otro solo venta rápida) y un botón «Separar para la convención» en el bloque
  de la especie que mueva N unidades al registro de la venta rápida (parecido a
  «Mover a…», que ya divide lotes en `move_animal`).
- **Cambios:** moderados (API + dashboard + recorrido de Playwright).

### 2. «Terminar convención»

- **Para qué:** al cerrar el evento, quitar todo de la venta rápida y regresar lo
  apartado a la tienda en un paso, sin repasar ejemplar por ejemplar.
- **Idea:** acción en la venta rápida o en «En venta»: `quick_sale=false` para
  todos y, si se hizo lo de apartar, fusionar cada registro de convención con su
  gemelo de la tienda (sumar existencias) o mostrarlo en la tienda.
- **Cambios:** pocos si va sola; moderados junto con lo de apartar.
