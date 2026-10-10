import { paths } from 'src/routes/paths';

import { CONFIG } from 'src/global-config';

import { SvgColor } from 'src/components/svg-color';

import { findSection } from './dashboard/section-tabs-config';

// ----------------------------------------------------------------------

const icon = (name) => <SvgColor src={`${CONFIG.assetsDir}/assets/icons/navbar/${name}.svg`} />;

const ICONS = {
  job: icon('ic-job'),
  blog: icon('ic-blog'),
  chat: icon('ic-chat'),
  mail: icon('ic-mail'),
  user: icon('ic-user'),
  file: icon('ic-file'),
  lock: icon('ic-lock'),
  tour: icon('ic-tour'),
  order: icon('ic-order'),
  label: icon('ic-label'),
  blank: icon('ic-blank'),
  kanban: icon('ic-kanban'),
  folder: icon('ic-folder'),
  course: icon('ic-course'),
  params: icon('ic-params'),
  banking: icon('ic-banking'),
  booking: icon('ic-booking'),
  invoice: icon('ic-invoice'),
  product: icon('ic-product'),
  calendar: icon('ic-calendar'),
  disabled: icon('ic-disabled'),
  external: icon('ic-external'),
  subpaths: icon('ic-subpaths'),
  menuItem: icon('ic-menu-item'),
  ecommerce: icon('ic-ecommerce'),
  analytics: icon('ic-analytics'),
  dashboard: icon('ic-dashboard'),
};

// ----------------------------------------------------------------------

/**
 * Input nav data is an array of navigation section items used to define the structure and content of a navigation bar.
 * Each section contains a subheader and an array of items, which can include nested children items.
 *
 * Each item can have the following properties:
 * - `title`: The title of the navigation item.
 * - `path`: The URL path the item links to.
 * - `icon`: An optional icon component to display alongside the title.
 * - `info`: Optional additional information to display, such as a label.
 * - `allowedRoles`: A list of PERMISSION strings the user must have at least one of (e.g. ['users.read']).
 *                   Leave empty/omit for items accessible to all authenticated users.
 * - `caption`: An optional caption to display below the title.
 * - `children`: An optional array of nested navigation items.
 * - `disabled`: An optional boolean to disable the item.
 * - `deepMatch`: An optional boolean to indicate if the item should match subpaths.
 */
// El item del menú queda activo en cualquier pestaña de su área. `except`
// evita doble resaltado (en /sale/new ya brilla "Nueva venta").
const inSection = (key, except = []) => (pathname) =>
  !except.includes(pathname) && findSection(pathname)?.section.key === key;

export const navData = [
  /**
   * General
   */
  {
    subheader: 'General',
    items: [
      { title: 'Inicio',       path: paths.dashboard.root,              icon: ICONS.dashboard },
      { title: 'Estadísticas', path: paths.dashboard.general.analytics, icon: ICONS.analytics },
    ],
  },
  /**
   * Una entrada por área. Las páginas de cada área se recorren con pestañas
   * arriba del contenido (layouts/dashboard/section-tabs-config.js); los
   * "Nuevo …" viven como botón dentro de cada lista.
   */
  {
    subheader: 'Vender',
    items: [
      { title: 'Nueva venta', path: paths.dashboard.sale.new,  icon: ICONS.ecommerce, allowedRoles: ['sales.create'] },
      { title: 'Ventas',      path: paths.dashboard.sale.root, icon: ICONS.invoice, isActive: inSection('ventas', [paths.dashboard.sale.new]) },
      { title: 'Pedidos web', path: paths.dashboard.order.root, icon: ICONS.order, allowedRoles: ['orders.read'] },
    ],
  },
  {
    subheader: 'Inventario',
    items: [
      { title: 'Animales',  path: paths.dashboard.animal.root,   icon: ICONS.tour,    isActive: inSection('animales') },
      { title: 'Productos', path: paths.dashboard.product.root,  icon: ICONS.product, isActive: inSection('productos') },
      {
        title: 'Compras',
        path: paths.dashboard.purchase.root,
        icon: ICONS.banking,
        allowedRoles: ['purchases.read', 'suppliers.read'],
        isActive: inSection('compras'),
      },
    ],
  },
  {
    subheader: 'Sitio web',
    items: [
      {
        title: 'Sitio web',
        path: paths.dashboard.article.root,
        icon: ICONS.file,
        allowedRoles: ['settings.update', 'articles.read'],
        isActive: inSection('sitio'),
      },
    ],
  },
  {
    subheader: 'Sistema',
    items: [
      {
        title: 'Ajustes',
        path: paths.dashboard.user.list,
        icon: ICONS.user,
        allowedRoles: ['users.read', 'roles.read', 'branches.read'],
        isActive: inSection('ajustes'),
      },
      { title: 'Sensor ambiental', path: paths.dashboard.sensor, icon: ICONS.analytics, allowedRoles: ['branches.read'] },
    ],
  },
];
