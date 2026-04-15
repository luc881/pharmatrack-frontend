const ROOTS = {
  AUTH: '/auth',
  DASHBOARD: '/dashboard',
};

// ----------------------------------------------------------------------

export const paths = {
  page403: '/error/403',
  page404: '/error/404',
  page500: '/error/500',
  // AUTH
  auth: {
    jwt: {
      signIn: `${ROOTS.AUTH}/jwt/sign-in`,
      signUp: `${ROOTS.AUTH}/jwt/sign-up`,
      forgotPassword: `${ROOTS.AUTH}/jwt/forgot-password`,
    },
    resetPassword: `${ROOTS.AUTH}/reset-password`,
  },
  // DASHBOARD
  dashboard: {
    root: ROOTS.DASHBOARD,
    calendar: `${ROOTS.DASHBOARD}/calendar`,
    sensor: `${ROOTS.DASHBOARD}/sensor`,
    general: {
      analytics: `${ROOTS.DASHBOARD}/analytics`,
    },
    user: {
      root: `${ROOTS.DASHBOARD}/user`,
      new: `${ROOTS.DASHBOARD}/user/new`,
      list: `${ROOTS.DASHBOARD}/user/list`,
      account: `${ROOTS.DASHBOARD}/user/account`,
      edit: (id) => `${ROOTS.DASHBOARD}/user/${id}/edit`,
    },
    supplier: {
      root: `${ROOTS.DASHBOARD}/supplier`,
      new: `${ROOTS.DASHBOARD}/supplier/new`,
      edit: (id) => `${ROOTS.DASHBOARD}/supplier/${id}/edit`,
    },
    branch: {
      root: `${ROOTS.DASHBOARD}/branch`,
      new: `${ROOTS.DASHBOARD}/branch/new`,
      edit: (id) => `${ROOTS.DASHBOARD}/branch/${id}/edit`,
    },
    productMaster: {
      root: `${ROOTS.DASHBOARD}/product-master`,
      new: `${ROOTS.DASHBOARD}/product-master/new`,
      edit: (id) => `${ROOTS.DASHBOARD}/product-master/${id}/edit`,
    },
    refundProduct: {
      root: `${ROOTS.DASHBOARD}/refund-product`,
      new: `${ROOTS.DASHBOARD}/refund-product/new`,
    },
    ingredient: {
      root: `${ROOTS.DASHBOARD}/ingredient`,
      new: `${ROOTS.DASHBOARD}/ingredient/new`,
      edit: (id) => `${ROOTS.DASHBOARD}/ingredient/${id}/edit`,
    },
    productBatch: {
      root: `${ROOTS.DASHBOARD}/product-batch`,
      new: `${ROOTS.DASHBOARD}/product-batch/new`,
      edit: (id) => `${ROOTS.DASHBOARD}/product-batch/${id}/edit`,
    },
    productCategory: {
      root: `${ROOTS.DASHBOARD}/product-category`,
      new: `${ROOTS.DASHBOARD}/product-category/new`,
      edit: (id) => `${ROOTS.DASHBOARD}/product-category/${id}/edit`,
    },
    productBrand: {
      root: `${ROOTS.DASHBOARD}/product-brand`,
      new: `${ROOTS.DASHBOARD}/product-brand/new`,
      edit: (id) => `${ROOTS.DASHBOARD}/product-brand/${id}/edit`,
    },
    role: {
      root: `${ROOTS.DASHBOARD}/role`,
      new: `${ROOTS.DASHBOARD}/role/new`,
      edit: (id) => `${ROOTS.DASHBOARD}/role/${id}/edit`,
    },
    sale: {
      root: `${ROOTS.DASHBOARD}/sale`,
      new: `${ROOTS.DASHBOARD}/sale/new`,
      details: (id) => `${ROOTS.DASHBOARD}/sale/${id}`,
      edit: (id) => `${ROOTS.DASHBOARD}/sale/${id}/edit`,
    },
    purchase: {
      root: `${ROOTS.DASHBOARD}/purchase`,
      new: `${ROOTS.DASHBOARD}/purchase/new`,
      details: (id) => `${ROOTS.DASHBOARD}/purchase/${id}`,
      edit: (id) => `${ROOTS.DASHBOARD}/purchase/${id}/edit`,
    },
    product: {
      root: `${ROOTS.DASHBOARD}/product`,
      new: `${ROOTS.DASHBOARD}/product/new`,
      details: (id) => `${ROOTS.DASHBOARD}/product/${id}`,
      edit: (id) => `${ROOTS.DASHBOARD}/product/${id}/edit`,
    },
  },
};
