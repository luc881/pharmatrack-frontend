import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------
// Áreas del dashboard: cada una es UNA entrada del menú lateral y sus páginas
// se recorren con pestañas arriba del contenido (SectionTabs). Para mover una
// página de área o renombrarla basta con tocar esta lista.
//
// - `path`: a dónde lleva la pestaña.
// - `match`: otras rutas que también la activan (la de `path` ya cuenta).
//   Gana el prefijo más largo, así /sale/summary activa "Corte de caja" y no
//   "Historial", y /sale/email-template cae en Ajustes.
// - `children`: pestaña con segunda fila (lleva al primer hijo visible).
// - `allowedRoles`: igual que en el menú; basta con tener uno.
// ----------------------------------------------------------------------

const D = paths.dashboard;

export const SECTIONS = [
  {
    key: 'ventas',
    tabs: [
      { label: 'Historial', path: D.sale.root },
      { label: 'Corte de caja', path: D.sale.summary },
      { label: 'Devoluciones', path: D.refundProduct.root },
    ],
  },
  {
    key: 'animales',
    tabs: [
      { label: 'Ejemplares', path: D.animal.root },
      { label: 'Hoja de inventario', path: D.animal.sheet },
      { label: 'Bitácora de manejo', path: D.animal.log },
      { label: 'Taxonomía y cultivos', path: D.animal.taxonomy, match: [`${D.animal.root}/species`] },
    ],
  },
  {
    key: 'productos',
    tabs: [
      { label: 'Productos', path: D.product.root },
      { label: 'Stock y lotes', path: D.productBatch.root },
      {
        label: 'Categorías y marcas',
        children: [
          { label: 'Categorías', path: D.productCategory.root },
          { label: 'Marcas', path: D.productBrand.root },
        ],
      },
      { label: 'Paquetes', path: D.bundle.root },
      {
        // Heredado de la farmacia: fuera del camino, pero a la mano
        label: 'Avanzado',
        children: [
          { label: 'Fórmulas genéricas', path: D.productMaster.root },
          { label: 'Sustancias', path: D.ingredient.root },
          { label: 'Calendario de caducidades', path: D.calendar },
        ],
      },
    ],
  },
  {
    key: 'compras',
    tabs: [
      { label: 'Compras', path: D.purchase.root, allowedRoles: ['purchases.read'] },
      { label: 'Proveedores', path: D.supplier.root, allowedRoles: ['suppliers.read'] },
    ],
  },
  {
    key: 'sitio',
    tabs: [
      { label: 'Artículos', path: D.article.root, allowedRoles: ['articles.read'] },
      { label: 'Fotos del sitio', path: D.site.media, allowedRoles: ['settings.update'] },
      { label: 'Links y eventos', path: D.site.links, allowedRoles: ['settings.update'] },
    ],
  },
  {
    key: 'ajustes',
    tabs: [
      { label: 'Usuarios', path: D.user.list, match: [D.user.root], allowedRoles: ['users.read'] },
      { label: 'Roles', path: D.role.root, allowedRoles: ['roles.read'] },
      { label: 'Sucursales', path: D.branch.root, allowedRoles: ['branches.read'] },
      { label: 'Plantilla del ticket', path: D.sale.emailTemplate },
    ],
  },
];

// ----------------------------------------------------------------------

// `/dashboard/product` cubre `/dashboard/product/12/edit` pero NO
// `/dashboard/product-batch`: se compara por segmento completo.
const covers = (prefix, pathname) => pathname === prefix || pathname.startsWith(`${prefix}/`);

// Área, pestaña y sub-pestaña de la ruta actual (o null si la ruta no es de
// ninguna área). Gana el prefijo más largo entre todas las áreas.
export function findSection(pathname) {
  let best = null;
  SECTIONS.forEach((section) => {
    section.tabs.forEach((tab) => {
      (tab.children ?? [tab]).forEach((leaf) => {
        [leaf.path, ...(leaf.match ?? [])].forEach((prefix) => {
          if (covers(prefix, pathname) && (!best || prefix.length > best.length)) {
            best = { section, tab, child: tab.children ? leaf : null, length: prefix.length };
          }
        });
      });
    });
  });
  return best;
}

// Para el buscador (⌘K): las pestañas ya no están en el menú, pero se tienen
// que poder encontrar. Mismo formato que una sección de nav-config.
export const SECTION_SEARCH = {
  subheader: 'Pestañas',
  items: SECTIONS.flatMap((section) =>
    section.tabs.flatMap((tab) =>
      (tab.children ?? [tab]).map((leaf) => ({
        title: tab.children ? `${tab.label} · ${leaf.label}` : leaf.label,
        path: leaf.path,
        allowedRoles: leaf.allowedRoles,
      }))
    )
  ),
};
