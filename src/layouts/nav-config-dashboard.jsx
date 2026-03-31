import { paths } from 'src/routes/paths';

import { CONFIG } from 'src/global-config';

import { SvgColor } from 'src/components/svg-color';

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
 * - `allowedRoles`: An optional array of roles that are allowed to see the item.
 * - `caption`: An optional caption to display below the title.
 * - `children`: An optional array of nested navigation items.
 * - `disabled`: An optional boolean to disable the item.
 * - `deepMatch`: An optional boolean to indicate if the item should match subpaths.
 */
export const navData = [
  /**
   * Overview
   */
  {
    subheader: 'Overview',
    items: [
      { title: 'Inicio', path: paths.dashboard.root, icon: ICONS.dashboard },
      { title: 'Estadísticas', path: paths.dashboard.general.analytics, icon: ICONS.analytics },
    ],
  },
  /**
   * Management
   */
  {
    subheader: 'Management',
    items: [
      {
        title: 'Usuarios',
        path: paths.dashboard.user.list,
        icon: ICONS.user,
        children: [
          { title: 'Lista', path: paths.dashboard.user.list },
          { title: 'Nuevo', path: paths.dashboard.user.new },
          { title: 'Mi cuenta', path: paths.dashboard.user.account, deepMatch: true },
        ],
      },
      {
        title: 'Roles',
        path: paths.dashboard.role.root,
        icon: ICONS.lock,
        children: [
          { title: 'Lista', path: paths.dashboard.role.root },
          { title: 'Nuevo', path: paths.dashboard.role.new },
        ],
      },
      {
        title: 'Productos',
        path: paths.dashboard.product.root,
        icon: ICONS.product,
        children: [
          { title: 'Lista', path: paths.dashboard.product.root },
          { title: 'Nuevo', path: paths.dashboard.product.new },
          { title: 'Categorías', path: paths.dashboard.productCategory.root },
          { title: 'Marcas', path: paths.dashboard.productBrand.root },
          { title: 'Lotes', path: paths.dashboard.productBatch.root },
          { title: 'Principios activos', path: paths.dashboard.productMaster.root },
          { title: 'Ingredientes', path: paths.dashboard.ingredient.root },
        ],
      },
      {
        title: 'Proveedores',
        path: paths.dashboard.supplier.root,
        icon: ICONS.order,
        children: [
          { title: 'Lista', path: paths.dashboard.supplier.root },
          { title: 'Nuevo', path: paths.dashboard.supplier.new },
        ],
      },
      {
        title: 'Compras',
        path: paths.dashboard.purchase.root,
        icon: ICONS.invoice,
        children: [
          { title: 'Lista', path: paths.dashboard.purchase.root },
          { title: 'Nueva', path: paths.dashboard.purchase.new },
        ],
      },
      {
        title: 'Ventas',
        path: paths.dashboard.sale.root,
        icon: ICONS.ecommerce,
        children: [
          { title: 'Lista', path: paths.dashboard.sale.root },
          { title: 'Nueva', path: paths.dashboard.sale.new },
        ],
      },
      {
        title: 'Devoluciones',
        path: paths.dashboard.refundProduct.root,
        icon: ICONS.label,
        children: [
          { title: 'Lista', path: paths.dashboard.refundProduct.root },
          { title: 'Nueva', path: paths.dashboard.refundProduct.new },
        ],
      },
      {
        title: 'Sucursales',
        path: paths.dashboard.branch.root,
        icon: ICONS.banking,
        children: [
          { title: 'Lista', path: paths.dashboard.branch.root },
          { title: 'Nueva', path: paths.dashboard.branch.new },
        ],
      },
      { title: 'Calendario', path: paths.dashboard.calendar, icon: ICONS.calendar },
    ],
  },
];
