import { lazy, Suspense } from 'react';
import { Outlet, Navigate } from 'react-router';

import { CONFIG } from 'src/global-config';
import { DashboardLayout } from 'src/layouts/dashboard';

import { LoadingScreen } from 'src/components/loading-screen';

import { AccountLayout } from 'src/sections/account/account-layout';

import { AuthGuard } from 'src/auth/guard';

import { usePathname } from '../hooks';

// ----------------------------------------------------------------------

// Overview
const IndexPage = lazy(() => import('src/pages/dashboard'));
const OverviewEcommercePage = lazy(() => import('src/pages/dashboard/ecommerce'));
const OverviewAnalyticsPage = lazy(() => import('src/pages/dashboard/analytics'));
const OverviewBankingPage = lazy(() => import('src/pages/dashboard/banking'));
const OverviewBookingPage = lazy(() => import('src/pages/dashboard/booking'));
const OverviewFilePage = lazy(() => import('src/pages/dashboard/file'));
const OverviewCoursePage = lazy(() => import('src/pages/dashboard/course'));
// Ingredient
const IngredientListPage = lazy(() => import('src/pages/dashboard/ingredient/list'));
const IngredientCreatePage = lazy(() => import('src/pages/dashboard/ingredient/new'));
const IngredientEditPage = lazy(() => import('src/pages/dashboard/ingredient/edit'));
// Sale detail
const SaleDetailsPage = lazy(() => import('src/pages/dashboard/sale/details'));
// Purchase detail
const PurchaseDetailsPage = lazy(() => import('src/pages/dashboard/purchase/details'));
// Branch
const BranchListPage = lazy(() => import('src/pages/dashboard/branch/list'));
const BranchCreatePage = lazy(() => import('src/pages/dashboard/branch/new'));
const BranchEditPage = lazy(() => import('src/pages/dashboard/branch/edit'));
// Product Master
const ProductMasterListPage = lazy(() => import('src/pages/dashboard/product-master/list'));
const ProductMasterCreatePage = lazy(() => import('src/pages/dashboard/product-master/new'));
const ProductMasterEditPage = lazy(() => import('src/pages/dashboard/product-master/edit'));
// Refund Product
const RefundProductListPage = lazy(() => import('src/pages/dashboard/refund-product/list'));
const RefundProductCreatePage = lazy(() => import('src/pages/dashboard/refund-product/new'));
// Product Batch
const ProductBatchListPage = lazy(() => import('src/pages/dashboard/product-batch/list'));
const ProductBatchCreatePage = lazy(() => import('src/pages/dashboard/product-batch/new'));
const ProductBatchEditPage = lazy(() => import('src/pages/dashboard/product-batch/edit'));
// Product Category
const ProductCategoryListPage = lazy(() => import('src/pages/dashboard/product-category/list'));
const ProductCategoryCreatePage = lazy(() => import('src/pages/dashboard/product-category/new'));
const ProductCategoryEditPage = lazy(() => import('src/pages/dashboard/product-category/edit'));
// Product Brand
const ProductBrandListPage = lazy(() => import('src/pages/dashboard/product-brand/list'));
const ProductBrandCreatePage = lazy(() => import('src/pages/dashboard/product-brand/new'));
const ProductBrandEditPage = lazy(() => import('src/pages/dashboard/product-brand/edit'));
// Role
const RoleListPage = lazy(() => import('src/pages/dashboard/role/list'));
const RoleCreatePage = lazy(() => import('src/pages/dashboard/role/new'));
const RoleEditPage = lazy(() => import('src/pages/dashboard/role/edit'));
// Sale
const SaleListPage = lazy(() => import('src/pages/dashboard/sale/list'));
const SaleCreatePage = lazy(() => import('src/pages/dashboard/sale/new'));
const SaleEditPage = lazy(() => import('src/pages/dashboard/sale/edit'));
// Purchase
const PurchaseListPage = lazy(() => import('src/pages/dashboard/purchase/list'));
const PurchaseCreatePage = lazy(() => import('src/pages/dashboard/purchase/new'));
const PurchaseEditPage = lazy(() => import('src/pages/dashboard/purchase/edit'));
// Supplier
const SupplierListPage = lazy(() => import('src/pages/dashboard/supplier/list'));
const SupplierCreatePage = lazy(() => import('src/pages/dashboard/supplier/new'));
const SupplierEditPage = lazy(() => import('src/pages/dashboard/supplier/edit'));
// Product
const ProductDetailsPage = lazy(() => import('src/pages/dashboard/product/details'));
const ProductListPage = lazy(() => import('src/pages/dashboard/product/list'));
const ProductCreatePage = lazy(() => import('src/pages/dashboard/product/new'));
const ProductEditPage = lazy(() => import('src/pages/dashboard/product/edit'));
// Order
const OrderListPage = lazy(() => import('src/pages/dashboard/order/list'));
const OrderDetailsPage = lazy(() => import('src/pages/dashboard/order/details'));
// Invoice
const InvoiceListPage = lazy(() => import('src/pages/dashboard/invoice/list'));
const InvoiceDetailsPage = lazy(() => import('src/pages/dashboard/invoice/details'));
const InvoiceCreatePage = lazy(() => import('src/pages/dashboard/invoice/new'));
const InvoiceEditPage = lazy(() => import('src/pages/dashboard/invoice/edit'));
// User
const UserProfilePage = lazy(() => import('src/pages/dashboard/user/profile'));
const UserCardsPage = lazy(() => import('src/pages/dashboard/user/cards'));
const UserListPage = lazy(() => import('src/pages/dashboard/user/list'));
const UserCreatePage = lazy(() => import('src/pages/dashboard/user/new'));
const UserEditPage = lazy(() => import('src/pages/dashboard/user/edit'));
// Account
const AccountGeneralPage = lazy(() => import('src/pages/dashboard/user/account/general'));
const AccountBillingPage = lazy(() => import('src/pages/dashboard/user/account/billing'));
const AccountSocialsPage = lazy(() => import('src/pages/dashboard/user/account/socials'));
const AccountNotificationsPage = lazy(
  () => import('src/pages/dashboard/user/account/notifications')
);
const AccountChangePasswordPage = lazy(
  () => import('src/pages/dashboard/user/account/change-password')
);
// Blog
const BlogPostsPage = lazy(() => import('src/pages/dashboard/post/list'));
const BlogPostPage = lazy(() => import('src/pages/dashboard/post/details'));
const BlogNewPostPage = lazy(() => import('src/pages/dashboard/post/new'));
const BlogEditPostPage = lazy(() => import('src/pages/dashboard/post/edit'));
// Job
const JobDetailsPage = lazy(() => import('src/pages/dashboard/job/details'));
const JobListPage = lazy(() => import('src/pages/dashboard/job/list'));
const JobCreatePage = lazy(() => import('src/pages/dashboard/job/new'));
const JobEditPage = lazy(() => import('src/pages/dashboard/job/edit'));
// Tour
const TourDetailsPage = lazy(() => import('src/pages/dashboard/tour/details'));
const TourListPage = lazy(() => import('src/pages/dashboard/tour/list'));
const TourCreatePage = lazy(() => import('src/pages/dashboard/tour/new'));
const TourEditPage = lazy(() => import('src/pages/dashboard/tour/edit'));
// File manager
const FileManagerPage = lazy(() => import('src/pages/dashboard/file-manager'));
// App
const ChatPage = lazy(() => import('src/pages/dashboard/chat'));
const MailPage = lazy(() => import('src/pages/dashboard/mail'));
const CalendarPage = lazy(() => import('src/pages/dashboard/calendar'));
const KanbanPage = lazy(() => import('src/pages/dashboard/kanban'));
// Test render page by role
const PermissionDeniedPage = lazy(() => import('src/pages/dashboard/permission'));
// Blank page
const ParamsPage = lazy(() => import('src/pages/dashboard/params'));
const SubpathsPage = lazy(() => import('src/pages/dashboard/subpaths'));
const BlankPage = lazy(() => import('src/pages/dashboard/blank'));

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
      { path: 'ecommerce', element: <OverviewEcommercePage /> },
      { path: 'analytics', element: <OverviewAnalyticsPage /> },
      { path: 'banking', element: <OverviewBankingPage /> },
      { path: 'booking', element: <OverviewBookingPage /> },
      { path: 'file', element: <OverviewFilePage /> },
      { path: 'course', element: <OverviewCoursePage /> },
      {
        path: 'user',
        children: [
          { index: true, element: <UserProfilePage /> },
          { path: 'profile', element: <UserProfilePage /> },
          { path: 'cards', element: <UserCardsPage /> },
          { path: 'list', element: <UserListPage /> },
          { path: 'new', element: <UserCreatePage /> },
          { path: ':id/edit', element: <UserEditPage /> },
          {
            path: 'account',
            element: accountLayout(),
            children: [
              { index: true, element: <AccountGeneralPage /> },
              { path: 'billing', element: <AccountBillingPage /> },
              { path: 'notifications', element: <AccountNotificationsPage /> },
              { path: 'socials', element: <AccountSocialsPage /> },
              { path: 'change-password', element: <AccountChangePasswordPage /> },
            ],
          },
        ],
      },
      {
        path: 'ingredient',
        children: [
          { index: true, element: <IngredientListPage /> },
          { path: 'list', element: <IngredientListPage /> },
          { path: 'new', element: <IngredientCreatePage /> },
          { path: ':id/edit', element: <IngredientEditPage /> },
        ],
      },
      {
        path: 'branch',
        children: [
          { index: true, element: <BranchListPage /> },
          { path: 'list', element: <BranchListPage /> },
          { path: 'new', element: <BranchCreatePage /> },
          { path: ':id/edit', element: <BranchEditPage /> },
        ],
      },
      {
        path: 'product-master',
        children: [
          { index: true, element: <ProductMasterListPage /> },
          { path: 'list', element: <ProductMasterListPage /> },
          { path: 'new', element: <ProductMasterCreatePage /> },
          { path: ':id/edit', element: <ProductMasterEditPage /> },
        ],
      },
      {
        path: 'refund-product',
        children: [
          { index: true, element: <RefundProductListPage /> },
          { path: 'list', element: <RefundProductListPage /> },
          { path: 'new', element: <RefundProductCreatePage /> },
        ],
      },
      {
        path: 'product-batch',
        children: [
          { index: true, element: <ProductBatchListPage /> },
          { path: 'list', element: <ProductBatchListPage /> },
          { path: 'new', element: <ProductBatchCreatePage /> },
          { path: ':id/edit', element: <ProductBatchEditPage /> },
        ],
      },
      {
        path: 'product-category',
        children: [
          { index: true, element: <ProductCategoryListPage /> },
          { path: 'list', element: <ProductCategoryListPage /> },
          { path: 'new', element: <ProductCategoryCreatePage /> },
          { path: ':id/edit', element: <ProductCategoryEditPage /> },
        ],
      },
      {
        path: 'product-brand',
        children: [
          { index: true, element: <ProductBrandListPage /> },
          { path: 'list', element: <ProductBrandListPage /> },
          { path: 'new', element: <ProductBrandCreatePage /> },
          { path: ':id/edit', element: <ProductBrandEditPage /> },
        ],
      },
      {
        path: 'role',
        children: [
          { index: true, element: <RoleListPage /> },
          { path: 'list', element: <RoleListPage /> },
          { path: 'new', element: <RoleCreatePage /> },
          { path: ':id/edit', element: <RoleEditPage /> },
        ],
      },
      {
        path: 'sale',
        children: [
          { index: true, element: <SaleListPage /> },
          { path: 'list', element: <SaleListPage /> },
          { path: 'new', element: <SaleCreatePage /> },
          { path: ':id', element: <SaleDetailsPage /> },
          { path: ':id/edit', element: <SaleEditPage /> },
        ],
      },
      {
        path: 'purchase',
        children: [
          { index: true, element: <PurchaseListPage /> },
          { path: 'list', element: <PurchaseListPage /> },
          { path: 'new', element: <PurchaseCreatePage /> },
          { path: ':id', element: <PurchaseDetailsPage /> },
          { path: ':id/edit', element: <PurchaseEditPage /> },
        ],
      },
      {
        path: 'supplier',
        children: [
          { index: true, element: <SupplierListPage /> },
          { path: 'list', element: <SupplierListPage /> },
          { path: 'new', element: <SupplierCreatePage /> },
          { path: ':id/edit', element: <SupplierEditPage /> },
        ],
      },
      {
        path: 'product',
        children: [
          { index: true, element: <ProductListPage /> },
          { path: 'list', element: <ProductListPage /> },
          { path: ':id', element: <ProductDetailsPage /> },
          { path: 'new', element: <ProductCreatePage /> },
          { path: ':id/edit', element: <ProductEditPage /> },
        ],
      },
      {
        path: 'order',
        children: [
          { index: true, element: <OrderListPage /> },
          { path: 'list', element: <OrderListPage /> },
          { path: ':id', element: <OrderDetailsPage /> },
        ],
      },
      {
        path: 'invoice',
        children: [
          { index: true, element: <InvoiceListPage /> },
          { path: 'list', element: <InvoiceListPage /> },
          { path: ':id', element: <InvoiceDetailsPage /> },
          { path: ':id/edit', element: <InvoiceEditPage /> },
          { path: 'new', element: <InvoiceCreatePage /> },
        ],
      },
      {
        path: 'post',
        children: [
          { index: true, element: <BlogPostsPage /> },
          { path: 'list', element: <BlogPostsPage /> },
          { path: ':title', element: <BlogPostPage /> },
          { path: ':title/edit', element: <BlogEditPostPage /> },
          { path: 'new', element: <BlogNewPostPage /> },
        ],
      },
      {
        path: 'job',
        children: [
          { index: true, element: <JobListPage /> },
          { path: 'list', element: <JobListPage /> },
          { path: ':id', element: <JobDetailsPage /> },
          { path: 'new', element: <JobCreatePage /> },
          { path: ':id/edit', element: <JobEditPage /> },
        ],
      },
      {
        path: 'tour',
        children: [
          { index: true, element: <TourListPage /> },
          { path: 'list', element: <TourListPage /> },
          { path: ':id', element: <TourDetailsPage /> },
          { path: 'new', element: <TourCreatePage /> },
          { path: ':id/edit', element: <TourEditPage /> },
        ],
      },
      { path: 'file-manager', element: <FileManagerPage /> },
      { path: 'mail', element: <MailPage /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'kanban', element: <KanbanPage /> },
      { path: 'permission', element: <PermissionDeniedPage /> },
      { path: 'params', element: <ParamsPage /> },
      { path: 'blank', element: <BlankPage /> },
      {
        path: 'subpaths',
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard/subpaths/sub-1/sub-2" />,
          },
          { path: 'sub-1/sub-2', element: <SubpathsPage /> },
        ],
      },
    ],
  },
];
