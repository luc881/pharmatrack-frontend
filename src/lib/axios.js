import axios from 'axios';

import { CONFIG } from 'src/global-config';

// ----------------------------------------------------------------------

const axiosInstance = axios.create({
  baseURL: CONFIG.serverUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Optional: Add token (if using auth)
 *
 axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
*
*/

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error?.response?.data?.message || error?.message || 'Something went wrong!';
    console.error('Axios error:', message);
    return Promise.reject(new Error(message));
  }
);

export default axiosInstance;

// ----------------------------------------------------------------------

export const fetcher = async (args) => {
  try {
    const [url, config] = Array.isArray(args) ? args : [args, {}];

    const res = await axiosInstance.get(url, config);

    return res.data;
  } catch (error) {
    console.error('Fetcher failed:', error);
    throw error;
  }
};

// ----------------------------------------------------------------------

export const endpoints = {
  chat: '/api/chat',
  kanban: '/api/kanban',
  calendar: {
    events: '/api/v1/calendar/events',
  },
  auth: {
    signIn: '/api/v1/auth/token',
    refresh: '/api/v1/auth/refresh',
    signOut: '/api/v1/auth/logout',
  },
  mail: {
    list: '/api/mail/list',
    details: '/api/mail/details',
    labels: '/api/mail/labels',
  },
  post: {
    list: '/api/post/list',
    details: '/api/post/details',
    latest: '/api/post/latest',
    search: '/api/post/search',
  },
  product: {
    list: '/api/v1/products/',
    details: (id) => `/api/v1/products/${id}`,
    create: '/api/v1/products/',
    update: (id) => `/api/v1/products/${id}`,
    delete: (id) => `/api/v1/products/${id}`,
  },
  supplier: {
    list: '/api/v1/suppliers/',
    details: (id) => `/api/v1/suppliers/${id}`,
    create: '/api/v1/suppliers/',
    update: (id) => `/api/v1/suppliers/${id}`,
    delete: (id) => `/api/v1/suppliers/${id}`,
  },
  branch: {
    list: '/api/v1/branches/',
    details: (id) => `/api/v1/branches/${id}`,
    create: '/api/v1/branches/',
    update: (id) => `/api/v1/branches/${id}`,
    delete: (id) => `/api/v1/branches/${id}`,
  },
  productMaster: {
    list: '/api/v1/productsmaster/',
    details: (id) => `/api/v1/productsmaster/${id}`,
    create: '/api/v1/productsmaster/',
    update: (id) => `/api/v1/productsmaster/${id}`,
    delete: (id) => `/api/v1/productsmaster/${id}`,
  },
  refundProduct: {
    list: '/api/v1/refundproducts/',
    details: (id) => `/api/v1/refundproducts/${id}`,
    create: '/api/v1/refundproducts/',
    delete: (id) => `/api/v1/refundproducts/${id}`,
  },
  user: {
    list: '/api/v1/users/',
    details: (id) => `/api/v1/users/${id}`,
    create: '/api/v1/users/',
    update: (id) => `/api/v1/users/${id}`,
    delete: (id) => `/api/v1/users/${id}`,
    changePassword: (id) => `/api/v1/users/${id}/change-password`,
  },
  role: {
    list: '/api/v1/roles/',
    details: (id) => `/api/v1/roles/${id}`,
    create: '/api/v1/roles/',
    update: (id) => `/api/v1/roles/${id}`,
    delete: (id) => `/api/v1/roles/${id}`,
  },
  permission: {
    list: '/api/v1/permissions/',
  },
  sale: {
    list: '/api/v1/sales/',
    details: (id) => `/api/v1/sales/${id}`,
    create: '/api/v1/sales/',
    update: (id) => `/api/v1/sales/${id}`,
    delete: (id) => `/api/v1/sales/${id}`,
  },
  saleDetail: {
    list: '/api/v1/saledetails/',
    create: '/api/v1/saledetails/',
    delete: (id) => `/api/v1/saledetails/${id}`,
  },
  salePayment: {
    list: '/api/v1/salepayments/',
    create: '/api/v1/salepayments/',
    delete: (id) => `/api/v1/salepayments/${id}`,
  },
  saleBatchUsage: {
    list: '/api/v1/salebatchusages/',
    create: '/api/v1/salebatchusages/',
    delete: (id) => `/api/v1/salebatchusages/${id}`,
  },
  purchase: {
    list: '/api/v1/purchases/',
    details: (id) => `/api/v1/purchases/${id}`,
    create: '/api/v1/purchases/',
    update: (id) => `/api/v1/purchases/${id}`,
    delete: (id) => `/api/v1/purchases/${id}`,
  },
  purchaseDetail: {
    list: '/api/v1/purchase-details/',
    create: '/api/v1/purchase-details/',
    delete: (id) => `/api/v1/purchase-details/${id}`,
  },
  productBatch: {
    list: '/api/v1/productsbatches/',
    details: (id) => `/api/v1/productsbatches/${id}`,
    create: '/api/v1/productsbatches/',
    update: (id) => `/api/v1/productsbatches/${id}`,
    delete: (id) => `/api/v1/productsbatches/${id}`,
  },
  productCategory: {
    list: '/api/v1/productscategories/',
    details: (id) => `/api/v1/productscategories/${id}`,
    create: '/api/v1/productscategories/',
    update: (id) => `/api/v1/productscategories/${id}`,
    delete: (id) => `/api/v1/productscategories/${id}`,
  },
  productBrand: {
    list: '/api/v1/productsbrand/',
    details: (id) => `/api/v1/productsbrand/${id}`,
    create: '/api/v1/productsbrand/',
    update: (id) => `/api/v1/productsbrand/${id}`,
    delete: (id) => `/api/v1/productsbrand/${id}`,
  },
  ingredient: {
    list: '/api/v1/ingredients/',
    details: (id) => `/api/v1/ingredients/${id}`,
    create: '/api/v1/ingredients/',
    update: (id) => `/api/v1/ingredients/${id}`,
    delete: (id) => `/api/v1/ingredients/${id}`,
  },
  stats: {
    dashboard: '/api/v1/stats/dashboard',
  },
  dashboard: {
    stats: '/api/v1/dashboard/stats',
  },
  sensor: {
    create: '/api/v1/sensor-readings/',
    latest: '/api/v1/sensor-readings/latest',
    list: '/api/v1/sensor-readings/',
  },
  // Legacy aliases used by fetchAllPages in product.js
  productCategories: {
    list: '/api/v1/productscategories/',
  },
  productBrands: {
    list: '/api/v1/productsbrand/',
  },
};
