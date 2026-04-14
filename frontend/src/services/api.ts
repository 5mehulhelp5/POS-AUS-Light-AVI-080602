import axios from 'axios';

const API_BASE_URL = '/api/v1';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('pos_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (credentials: { email: string; password: string }) =>
    api.post('/auth/login', credentials),

  pinLogin: (pinCode: string) => api.post('/auth/pin-login', { pinCode }),

  logout: () => api.post('/auth/logout'),

  getMe: () => api.get('/auth/me'),
};

// Products API
export const productsApi = {
  getProducts: (params?: {
    search?: string;
    category?: number;
    inStock?: boolean;
    page?: number;
    limit?: number;
  }) => api.get('/products', { params }),

  getProduct: (id: number) => api.get(`/products/${id}`),

  getByBarcode: (barcode: string) => api.get(`/products/barcode/${barcode}`),

  getBySku: (sku: string) => api.get(`/products/sku/${sku}`),

  getCategories: () => api.get('/products/categories'),

  getSubcategories: (categoryId: number) =>
    api.get(`/products/categories/${categoryId}/subcategories`),
};

// Customers API
export const customersApi = {
  getCustomers: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get('/customers', { params }),

  getCustomer: (id: number) => api.get(`/customers/${id}`),

  createCustomer: (data: any) => api.post('/customers', data),

  updateCustomer: (id: number, data: any) => api.put(`/customers/${id}`, data),
};

// Orders API
export const ordersApi = {
  getOrders: (params?: {
    status?: string;
    source?: string;
    search?: string;
    userId?: number;
    customerId?: number;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) => api.get('/orders', { params }),

  getOrder: (id: number) => api.get(`/orders/${id}`),

  createOrder: (data: any) => api.post('/orders', data),

  createRefund: (
    orderId: number,
    data: {
      reason: string;
      reasonText?: string;
      items: Array<{ orderItemId: number; quantity: number; restock: boolean }>;
    },
  ) => api.post(`/orders/${orderId}/refund`, data),

  getRefunds: (orderId: number) => api.get(`/orders/${orderId}/refunds`),
};

// Discounts API
export const discountsApi = {
  validate: (data: {
    items: Array<{
      productId: number;
      sku?: string;
      name?: string;
      quantity: number;
      unitPrice: number;
      discountPercent?: number;
    }>;
    cartDiscount?: {
      type: 'percent' | 'fixed';
      value: number;
      reason?: string;
    };
  }) => api.post('/discounts/validate', data),
};

// Quotes API
export const quotesApi = {
  getQuotes: (params?: {
    status?: string;
    customerId?: number;
    page?: number;
    limit?: number;
  }) => api.get('/quotes', { params }),

  getQuote: (id: number) => api.get(`/quotes/${id}`),

  createQuote: (data: any) => api.post('/quotes', data),

  updateQuote: (id: number, data: any) => api.put(`/quotes/${id}`, data),

  convertToOrder: (id: number, payments: any[]) =>
    api.post(`/quotes/${id}/convert`, { payments }),
};

// Users API (Admin only)
export const usersApi = {
  getUsers: (params?: {
    page?: number;
    limit?: number;
    role?: string;
    active?: boolean;
  }) => api.get('/users', { params }),

  getUser: (id: number) => api.get(`/users/${id}`),

  createUser: (data: any) => api.post('/users', data),

  updateUser: (id: number, data: any) => api.put(`/users/${id}`, data),

  deleteUser: (id: number) => api.delete(`/users/${id}`),

  getRoles: () => api.get('/users/roles'),
};

// Inquiries API
export const inquiriesApi = {
  getInquiries: (params?: {
    status?: string;
    type?: string;
    customerId?: number;
    page?: number;
    limit?: number;
  }) => api.get('/inquiries', { params }),

  getInquiry: (id: number) => api.get(`/inquiries/${id}`),

  createInquiry: (data: any) => api.post('/inquiries', data),

  updateInquiry: (id: number, data: any) => api.put(`/inquiries/${id}`, data),
};

// Reports API
export const reportsApi = {
  getSalesReport: (params: { dateFrom: string; dateTo: string; groupBy?: string }) =>
    api.get('/reports/sales', { params }),

  getSalesByUser: (params: { dateFrom: string; dateTo: string }) =>
    api.get('/reports/sales-by-user', { params }),

  getDiscountReport: (params: { dateFrom: string; dateTo: string }) =>
    api.get('/reports/discounts', { params }),

  getQuotesReport: (params: { dateFrom: string; dateTo: string }) =>
    api.get('/reports/quotes', { params }),
};

// Settings API (Admin only)
export const settingsApi = {
  // Store settings
  getStoreSettings: () => api.get('/settings/store'),

  updateStoreSettings: (data: {
    store_name?: string;
    store_abn?: string;
    store_address?: string;
    store_phone?: string;
    store_email?: string;
    tax_rate?: number;
    quote_expiry_days?: number;
    trading_hours?: any;
  }) => api.put('/settings/store', data),

  // Payment settings
  getPaymentSettings: () => api.get('/settings/payments'),

  updatePaymentSettings: (data: {
    payment_cash_enabled?: boolean;
    payment_eftpos_enabled?: boolean;
    payment_credit_card_enabled?: boolean;
    payment_store_credit_enabled?: boolean;
    default_payment_method?: string;
  }) => api.put('/settings/payments', data),

  // Role settings
  getRoles: () => api.get('/settings/roles'),

  updateRole: (
    id: number,
    data: {
      displayName?: string;
      maxDiscountPercent?: number;
      canStackDiscounts?: boolean;
    }
  ) => api.put(`/settings/roles/${id}`, data),

  // System settings
  getSystemSettings: () => api.get('/settings/system'),

  updateSystemSettings: (data: {
    receipt_print_enabled?: boolean;
    receipt_logo_url?: string;
    receipt_footer_text?: string;
    default_stock_hold?: boolean;
    offline_mode_enabled?: boolean;
  }) => api.put('/settings/system', data),
};

// Sync API (Admin only)
export const syncApi = {
  getStatus: () => api.get('/sync/status'),
  testConnection: () => api.get('/sync/test-connection'),
  syncCategories: () => api.post('/sync/categories'),
  syncProducts: () => api.post('/sync/products'),
  syncCustomers: () => api.post('/sync/customers'),
  syncOrders: () => api.post('/sync/orders'),
  getOrderSyncStatus: () => api.get('/sync/orders-status'),
  syncStock: () => api.post('/sync/stock'),
  fullSync: () => api.post('/sync/full'),
  clearAndSync: () => api.post('/sync/clear-and-sync'),
};

// Competitor API
export const competitorApi = {
  getPrice: (productName: string, sku?: string) =>
    api.get('/competitor/price', { params: { name: productName, sku } }),
};

export default api;
