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
  calendar: '/api/calendar',
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
  },
  user: {
    list: '/api/v1/users/',
    details: (id) => `/api/v1/users/${id}`,
    create: '/api/v1/users/',
    update: (id) => `/api/v1/users/${id}`,
    delete: (id) => `/api/v1/users/${id}`,
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
  productCategories: {
    list: '/api/v1/productscategories/',
  },
  productBrands: {
    list: '/api/v1/productsbrand/',
  },
};
