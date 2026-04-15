import { Outlet } from 'react-router';
import { lazy, Suspense } from 'react';

import { CONFIG } from 'src/global-config';
import { DashboardLayout } from 'src/layouts/dashboard';

import { LoadingScreen } from 'src/components/loading-screen';

import { AccountLayout } from 'src/sections/account/account-layout';

import { AuthGuard } from 'src/auth/guard';
import { RoleBasedGuard } from 'src/auth/guard/role-based-guard';

import { usePathname } from '../hooks';

// ----------------------------------------------------------------------

// Overview
const IndexPage             = lazy(() => import('src/pages/dashboard'));
const OverviewAnalyticsPage = lazy(() => import('src/pages/dashboard/analytics'));
// User
const UserListPage           = lazy(() => import('src/pages/dashboard/user/list'));
const UserCreatePage         = lazy(() => import('src/pages/dashboard/user/new'));
const UserEditPage           = lazy(() => import('src/pages/dashboard/user/edit'));
// Account
const AccountGeneralPage        = lazy(() => import('src/pages/dashboard/user/account/general'));
const AccountChangePasswordPage = lazy(() => import('src/pages/dashboard/user/account/change-password'));
// Role
const RoleListPage   = lazy(() => import('src/pages/dashboard/role/list'));
const RoleCreatePage = lazy(() => import('src/pages/dashboard/role/new'));
const RoleEditPage   = lazy(() => import('src/pages/dashboard/role/edit'));
// Product
const ProductListPage    = lazy(() => import('src/pages/dashboard/product/list'));
const ProductDetailsPage = lazy(() => import('src/pages/dashboard/product/details'));
const ProductCreatePage  = lazy(() => import('src/pages/dashboard/product/new'));
const ProductEditPage    = lazy(() => import('src/pages/dashboard/product/edit'));
// Product sub-modules
const ProductBatchListPage      = lazy(() => import('src/pages/dashboard/product-batch/list'));
const ProductBatchCreatePage    = lazy(() => import('src/pages/dashboard/product-batch/new'));
const ProductBatchEditPage      = lazy(() => import('src/pages/dashboard/product-batch/edit'));
const ProductCategoryListPage   = lazy(() => import('src/pages/dashboard/product-category/list'));
const ProductCategoryCreatePage = lazy(() => import('src/pages/dashboard/product-category/new'));
const ProductCategoryEditPage   = lazy(() => import('src/pages/dashboard/product-category/edit'));
const ProductBrandListPage      = lazy(() => import('src/pages/dashboard/product-brand/list'));
const ProductBrandCreatePage    = lazy(() => import('src/pages/dashboard/product-brand/new'));
const ProductBrandEditPage      = lazy(() => import('src/pages/dashboard/product-brand/edit'));
const ProductMasterListPage     = lazy(() => import('src/pages/dashboard/product-master/list'));
const ProductMasterCreatePage   = lazy(() => import('src/pages/dashboard/product-master/new'));
const ProductMasterEditPage     = lazy(() => import('src/pages/dashboard/product-master/edit'));
const IngredientListPage        = lazy(() => import('src/pages/dashboard/ingredient/list'));
const IngredientCreatePage      = lazy(() => import('src/pages/dashboard/ingredient/new'));
const IngredientEditPage        = lazy(() => import('src/pages/dashboard/ingredient/edit'));
// Supplier
const SupplierListPage   = lazy(() => import('src/pages/dashboard/supplier/list'));
const SupplierCreatePage = lazy(() => import('src/pages/dashboard/supplier/new'));
const SupplierEditPage   = lazy(() => import('src/pages/dashboard/supplier/edit'));
// Purchase
const PurchaseListPage    = lazy(() => import('src/pages/dashboard/purchase/list'));
const PurchaseCreatePage  = lazy(() => import('src/pages/dashboard/purchase/new'));
const PurchaseEditPage    = lazy(() => import('src/pages/dashboard/purchase/edit'));
const PurchaseDetailsPage = lazy(() => import('src/pages/dashboard/purchase/details'));
// Sale
const SaleListPage    = lazy(() => import('src/pages/dashboard/sale/list'));
const SaleCreatePage  = lazy(() => import('src/pages/dashboard/sale/new'));
const SaleEditPage    = lazy(() => import('src/pages/dashboard/sale/edit'));
const SaleDetailsPage = lazy(() => import('src/pages/dashboard/sale/details'));
// Refund
const RefundProductListPage   = lazy(() => import('src/pages/dashboard/refund-product/list'));
const RefundProductCreatePage = lazy(() => import('src/pages/dashboard/refund-product/new'));
// Branch
const BranchListPage   = lazy(() => import('src/pages/dashboard/branch/list'));
const BranchCreatePage = lazy(() => import('src/pages/dashboard/branch/new'));
const BranchEditPage   = lazy(() => import('src/pages/dashboard/branch/edit'));
// Calendar
const CalendarPage = lazy(() => import('src/pages/dashboard/calendar'));
// Sensor
const SensorPage = lazy(() => import('src/pages/dashboard/sensor'));

// ----------------------------------------------------------------------

// Permission constants — match the exact strings the backend stores in the permissions table.
// Format: '{resource}.{action}'  e.g. 'users.read', 'branches.create'
const P = {
  // Users
  usersRead:   ['users.read'],
  usersCreate: ['users.create'],
  usersUpdate: ['users.update'],
  // Roles
  rolesRead:   ['roles.read'],
  rolesCreate: ['roles.create'],
  rolesUpdate: ['roles.update'],
  // Products
  productsCreate:            ['products.create'],
  productsUpdate:            ['products.update'],
  productBatchesCreate:      ['productbatches.create'],
  productBatchesUpdate:      ['productbatches.update'],
  productCategoriesCreate:   ['productscategories.create'],
  productCategoriesUpdate:   ['productscategories.update'],
  productBrandsCreate:       ['productbrands.create'],
  productBrandsUpdate:       ['productbrands.update'],
  productMastersCreate:      ['productmasters.create'],
  productMastersUpdate:      ['productmasters.update'],
  ingredientsCreate:         ['ingredients.create'],
  ingredientsUpdate:         ['ingredients.update'],
  // Suppliers
  suppliersRead:   ['suppliers.read'],
  suppliersCreate: ['suppliers.create'],
  suppliersUpdate: ['suppliers.update'],
  // Purchases
  purchasesRead:   ['purchases.read'],
  purchasesCreate: ['purchases.create'],
  purchasesUpdate: ['purchases.update'],
  // Branches
  branchesRead:   ['branches.read'],
  branchesCreate: ['branches.create'],
  branchesUpdate: ['branches.update'],
};

function guard(allowedPermissions, element) {
  return <RoleBasedGuard allowedPermissions={allowedPermissions}>{element}</RoleBasedGuard>;
}

// ----------------------------------------------------------------------

function SuspenseOutlet() {
  const pathname = usePathname();
  return (
    <Suspense key={pathname} fallback={<LoadingScreen />}>
      <Outlet />
    </Suspense>
  );
}

const dashboardLayout = () => (
  <DashboardLayout>
    <SuspenseOutlet />
  </DashboardLayout>
);

const accountLayout = () => (
  <AccountLayout>
    <SuspenseOutlet />
  </AccountLayout>
);

export const dashboardRoutes = [
  {
    path: 'dashboard',
    element: CONFIG.auth.skip ? dashboardLayout() : <AuthGuard>{dashboardLayout()}</AuthGuard>,
    children: [
      { index: true, element: <IndexPage /> },
      { path: 'analytics', element: <OverviewAnalyticsPage /> },

      // ── Users ──────────────────────────────────────────────────────
      {
        path: 'user',
        children: [
          { index: true,      element: guard(P.usersRead,   <UserListPage />) },
          { path: 'list',     element: guard(P.usersRead,   <UserListPage />) },
          { path: 'new',      element: guard(P.usersCreate, <UserCreatePage />) },
          { path: ':id/edit', element: guard(P.usersUpdate, <UserEditPage />) },
          {
            path: 'account',
            element: accountLayout(),
            children: [
              { index: true,             element: <AccountGeneralPage /> },
              { path: 'change-password', element: <AccountChangePasswordPage /> },
            ],
          },
        ],
      },

      // ── Roles ───────────────────────────────────────────────────────
      {
        path: 'role',
        children: [
          { index: true,      element: guard(P.rolesRead,   <RoleListPage />) },
          { path: 'list',     element: guard(P.rolesRead,   <RoleListPage />) },
          { path: 'new',      element: guard(P.rolesCreate, <RoleCreatePage />) },
          { path: ':id/edit', element: guard(P.rolesUpdate, <RoleEditPage />) },
        ],
      },

      // ── Products ────────────────────────────────────────────────────
      {
        path: 'product',
        children: [
          { index: true,      element: <ProductListPage /> },
          { path: 'list',     element: <ProductListPage /> },
          { path: ':id',      element: <ProductDetailsPage /> },
          { path: 'new',      element: guard(P.productsCreate, <ProductCreatePage />) },
          { path: ':id/edit', element: guard(P.productsUpdate, <ProductEditPage />) },
        ],
      },
      {
        path: 'product-batch',
        children: [
          { index: true,      element: <ProductBatchListPage /> },
          { path: 'list',     element: <ProductBatchListPage /> },
          { path: 'new',      element: guard(P.productBatchesCreate, <ProductBatchCreatePage />) },
          { path: ':id/edit', element: guard(P.productBatchesUpdate, <ProductBatchEditPage />) },
        ],
      },
      {
        path: 'product-category',
        children: [
          { index: true,      element: <ProductCategoryListPage /> },
          { path: 'list',     element: <ProductCategoryListPage /> },
          { path: 'new',      element: guard(P.productCategoriesCreate, <ProductCategoryCreatePage />) },
          { path: ':id/edit', element: guard(P.productCategoriesUpdate, <ProductCategoryEditPage />) },
        ],
      },
      {
        path: 'product-brand',
        children: [
          { index: true,      element: <ProductBrandListPage /> },
          { path: 'list',     element: <ProductBrandListPage /> },
          { path: 'new',      element: guard(P.productBrandsCreate, <ProductBrandCreatePage />) },
          { path: ':id/edit', element: guard(P.productBrandsUpdate, <ProductBrandEditPage />) },
        ],
      },
      {
        path: 'product-master',
        children: [
          { index: true,      element: <ProductMasterListPage /> },
          { path: 'list',     element: <ProductMasterListPage /> },
          { path: 'new',      element: guard(P.productMastersCreate, <ProductMasterCreatePage />) },
          { path: ':id/edit', element: guard(P.productMastersUpdate, <ProductMasterEditPage />) },
        ],
      },
      {
        path: 'ingredient',
        children: [
          { index: true,      element: <IngredientListPage /> },
          { path: 'list',     element: <IngredientListPage /> },
          { path: 'new',      element: guard(P.ingredientsCreate, <IngredientCreatePage />) },
          { path: ':id/edit', element: guard(P.ingredientsUpdate, <IngredientEditPage />) },
        ],
      },

      // ── Suppliers ───────────────────────────────────────────────────
      {
        path: 'supplier',
        children: [
          { index: true,      element: guard(P.suppliersRead,   <SupplierListPage />) },
          { path: 'list',     element: guard(P.suppliersRead,   <SupplierListPage />) },
          { path: 'new',      element: guard(P.suppliersCreate, <SupplierCreatePage />) },
          { path: ':id/edit', element: guard(P.suppliersUpdate, <SupplierEditPage />) },
        ],
      },

      // ── Purchases ───────────────────────────────────────────────────
      {
        path: 'purchase',
        children: [
          { index: true,      element: guard(P.purchasesRead,   <PurchaseListPage />) },
          { path: 'list',     element: guard(P.purchasesRead,   <PurchaseListPage />) },
          { path: 'new',      element: guard(P.purchasesCreate, <PurchaseCreatePage />) },
          { path: ':id',      element: guard(P.purchasesRead,   <PurchaseDetailsPage />) },
          { path: ':id/edit', element: guard(P.purchasesUpdate, <PurchaseEditPage />) },
        ],
      },

      // ── Sales ───────────────────────────────────────────────────────
      {
        path: 'sale',
        children: [
          { index: true,      element: <SaleListPage /> },
          { path: 'list',     element: <SaleListPage /> },
          { path: 'new',      element: <SaleCreatePage /> },
          { path: ':id',      element: <SaleDetailsPage /> },
          { path: ':id/edit', element: <SaleEditPage /> },
        ],
      },

      // ── Refunds ─────────────────────────────────────────────────────
      {
        path: 'refund-product',
        children: [
          { index: true,  element: <RefundProductListPage /> },
          { path: 'list', element: <RefundProductListPage /> },
          { path: 'new',  element: <RefundProductCreatePage /> },
        ],
      },

      // ── Branches ────────────────────────────────────────────────────
      {
        path: 'branch',
        children: [
          { index: true,      element: guard(P.branchesRead,   <BranchListPage />) },
          { path: 'list',     element: guard(P.branchesRead,   <BranchListPage />) },
          { path: 'new',      element: guard(P.branchesCreate, <BranchCreatePage />) },
          { path: ':id/edit', element: guard(P.branchesUpdate, <BranchEditPage />) },
        ],
      },

      // ── Calendar ────────────────────────────────────────────────────
      { path: 'calendar', element: <CalendarPage /> },

      // ── Sensor config ───────────────────────────────────────────────
      { path: 'sensor', element: guard(P.branchesRead, <SensorPage />) },
    ],
  },
];
