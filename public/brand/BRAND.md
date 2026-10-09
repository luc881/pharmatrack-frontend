# Opuntia Den — guía de marca para desarrollo

> Guía de referencia para Claude Code (y cualquier persona) que trabaje en **opuntiaden.com**.
> Antes de crear o modificar UI, lee este archivo y usa los tokens de `tokens.css`.
> Si el repo ya define colores o fuentes, **respeta los valores existentes** y alinéalos con esta guía; no dupliques variables.

## 1. Esencia

- **Qué es:** criadero de invertebrados y bioactivo en Col. Roma Norte, CDMX. Vende isópodos, colémbolos y fásmidos (por ejemplo *Phyllium gardabagusi* “Argopuro”).
- **Nombre:** “Opuntia Den”. *Opuntia* es el género del nopal; *den* es madriguera.
- **Estética:** editorial, cálida, hecha a mano, como una lámina botánica antigua. Fondo crema, tinta café, serif elegante y mucho aire.
- **Lema de la web:** “Vida en miniatura”.
- **Tono de los textos:** cercano, claro y en español de México. Frases cortas. Sin emojis en la interfaz.

## 2. Archivos en esta carpeta

| Ruta | Para qué |
|---|---|
| `tokens.css` | Variables CSS (`--od-*`) y clases utilitarias (`.od-label`, `.od-btn`, `.od-kicker`…). Fuente de verdad. |
| `tailwind.preset.js` | Mismos tokens para Tailwind (`bg-od-crema`, `font-display`, `tracking-label`…). |
| `tokens.json` | Mismos tokens en JSON (para scripts o design tools). |
| `referencia.html` | Página visual con colores, tipografía y componentes. Ábrela en el navegador. |
| `ornaments/` | SVG simples: `destello.svg`, `anillo-rayitas.svg`, `anillo-puntos.svg`, `divisor-hojas.svg`. Usan `currentColor`. |
| `assets/logo/` | Sello claro, oscuro y a una tinta; isotipo claro y oscuro (SVG responsivos con `viewBox`, PNG transparentes). |
| `assets/favicon/` | `favicon.svg`, `.ico`, PNG 16–512, `apple-touch-icon.png`, `site.webmanifest`, `head-snippet.html`. |
| `assets/instagram/` | Portadas de destacados en 6 colores (1080 × 1080). |
| `assets/print/` | PDFs de imprenta (tarjetas, etiquetas de precio, letrero, manta). No se usan en la web. |

## 3. Color

| Token | HEX | Uso |
|---|---|---|
| `--od-crema` | `#EAE3D7` | Fondo principal de la página |
| `--od-papel` | `#F4F0E9` | Tarjetas, botones claros, superficies |
| `--od-tinta` | `#3A3029` | Texto, líneas, iconos |
| `--od-noche` | `#2E2924` | Fondos oscuros, footer, bandas |
| `--od-tuna` | `#A8455C` | **Acento puntual**: estrellas, número de kicker, foco |
| `--od-gris` | `#6E6359` | Texto secundario |
| `--od-linea` | `#CBBFAE` | Divisores y bordes de 1 px |
| `--od-olivo` | `#5C6449` | Banda verde (“Vida en miniatura”) |
| `--od-arena-texto` | `#C9C0B2` | Texto secundario sobre noche |

**Familia de cremas** para alternar fondos o tarjetas: papel `#F4F0E9`, hueso `#EFE8DC`, crema `#EAE3D7`, lino `#E3D8C6` y arena `#D8CBB5`.

**Proporción:** alrededor de 65 % cremas, 20 % tinta (texto), 10 % noche y 5 % tuna. La tuna nunca va como fondo de bloques grandes ni en párrafos de texto.

**Contraste:** tinta sobre crema y papel sobre noche cumplen AA. No pongas texto gris sobre arena.

## 4. Tipografía

- **Display:** *Playfair Display* 400 (y 400 itálica). Se usa en titulares, el “OPUNTIA” del hero, nombres científicos y precios grandes.
- **Texto:** *Inter* 400/500/600. Se usa en cuerpo, botones, navegación y formularios.
- **Etiquetas:** Inter 500 en MAYÚSCULAS con `letter-spacing: .22em` (clase `.od-label`), por ejemplo “CRIADERO” o “OPUNTIA DEN — CIUDAD DE MÉXICO”.
- **Nombres científicos:** siempre en itálica (`.od-sci`): *Phyllium gardabagusi*. La localidad va entre comillas tipográficas y sin itálica: “Argopuro”.
- **Escala:** 11 · 13 · 16 · 20 · 28 · 40 · 56 px, y hero `clamp(56px, 12vw, 144px)`.
- No uses negritas en Playfair. La jerarquía se marca con tamaño, no con peso.

## 5. Logo

- **Logo principal: sello circular.** Lleva un anillo de rayitas, el texto curvo “OPUNTIA DEN” arriba y “CRIADERO · CDMX” abajo, dos estrellas tuna a los lados y un nopal a línea con dos tunas y dos destellos al centro.
  - `sello-claro.svg` va sobre fondos claros y `sello-oscuro.svg` sobre fondos oscuros o fotos.
  - `sello-una-tinta.svg` es solo para sellos de goma y kraft; no se usa en la web.
- **Isotipo** (`isotipo-*.svg`): el nopal dentro del anillo, sin texto. Es para avatar, loaders y espacios menores a 64 px.
- **Favicon** (`favicon.svg`): una versión simplificada de dos pencas sólidas con dos tunas ovaladas, un hueco y medias lunas. No lo sustituyas por el sello completo.
- **Tamaño mínimo** del sello: 96 px en pantalla (25 mm impreso). Debajo de eso usa el isotipo.
- **Área de respeto:** deja al menos el 10 % del diámetro libre alrededor.
- **No hacer:** estirar, rotar, recolorear fuera de la paleta, poner sombra o meter el sello sobre fotos muy contrastadas sin el sello oscuro.

## 6. Adornos (el lenguaje gráfico)

Salen del sello y conviene usarlos con moderación, a lo mucho uno o dos por sección:

1. **Anillo de rayitas** (`anillo-rayitas.svg`) y **borde de rayitas** (`.od-ticks`). Sirven para cintas superiores de tarjetas, etiquetas y separadores de sección.
2. **Anillo de puntos** (`anillo-puntos.svg`). Va detrás de imágenes circulares o del sello.
3. **Destello de 4 puntas** (`destello.svg` / `.od-star`) en tuna. Se usa como viñeta, separador de metadatos (“Isópodos ✦ Colémbolos”) o junto a precios.
4. **Divisor con hojitas** (`divisor-hojas.svg`). Va entre secciones de texto largo.
5. **Kicker numerado** (`.od-kicker`): `02 —— LO ESENCIAL`, con el número en tuna. Úsalo solo cuando el orden importa, como en pasos o guías.

## 7. Componentes base

```html
<!-- Etiqueta + titular -->
<p class="od-label">Criadero</p>
<h1 class="od-display" style="font-size:var(--od-text-hero)">OPUNTIA</h1>

<!-- Botón píldora (como “Ver catálogo”) -->
<a class="od-btn" href="/catalogo">Ver catálogo</a>
<a class="od-btn od-btn--outline" href="https://www.instagram.com/opuntia_den/">Instagram</a>

<!-- Ficha de especie -->
<article class="od-card" style="padding:var(--od-space-6)">
  <div class="od-ticks"></div>
  <p class="od-label" style="color:var(--od-accent)">Fásmidos</p>
  <h3 class="od-sci" style="font-size:var(--od-text-xl)">Phyllium gardabagusi</h3>
  <p style="color:var(--od-text-muted)">“Argopuro” · Java, Indonesia</p>
</article>

<!-- Divisor -->
<div class="od-divider"><img src="/brand/ornaments/divisor-hojas.svg" alt="" width="64"></div>
```

Para las reglas de UI:

- **Botones:** pastilla (`--od-radius-pill`) con padding generoso. El primario es papel sobre fondo oscuro o tinta sobre crema; el secundario va con contorno.
- **Tarjetas:** fondo papel, borde de 1 px en línea y sombra plana (`--od-shadow-flat`). Sin sombras difusas ni degradados.
- **Bordes:** 1 px en `--od-linea`. Radios chicos (4–10 px), salvo los botones.
- **Fotos:** naturales, de musgo, sustrato y animales. Si llevan texto encima, agrega un velo noche de 30–45 %.
- **Foco:** contorno de 2 px en tuna con `outline-offset: 3px`.
- **Movimiento:** sutil (150–250 ms, `ease`). Respeta `prefers-reduced-motion`.

## 8. Datos de contacto (fuente única)

- Web: `opuntiaden.com`
- Instagram: `@opuntia_den` → https://www.instagram.com/opuntia_den/
- Teléfono: `56 2157 8388`
- Zona: Col. Roma Norte, Ciudad de México

## 9. Integración rápida (checklist para el agente)

1. Copia `brand/` a la carpeta pública del proyecto, por ejemplo `public/brand/` en Next o Vite.
2. Importa `tokens.css` en el CSS global. Si usan Tailwind, agrega `tailwind.preset.js` a `presets`.
3. Pega `assets/favicon/head-snippet.html` en el `<head>` y ajusta las rutas.
4. Sustituye los colores y fuentes que estén codificados a mano por los tokens `--od-*`.
5. Usa `sello-claro.svg` o `isotipo-claro.svg` en header y footer según el espacio, y `sello-oscuro.svg` en el footer oscuro.
6. Revisa `referencia.html` para comparar el resultado visual.
