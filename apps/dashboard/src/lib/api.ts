import { getAccessToken, clearSession } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401) {
    clearSession();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message ?? `HTTP ${res.status}`);
  return body as T;
}

/** Exported alias used by vertical.ts */
export const apiFetch = request;

export const api = {
  // ─── Auth ────────────────────────────────────────────────────────────────
  registerTenant: (data: {
    tenantName: string;
    subdomain: string;
    businessType: string;
    ownerName: string;
    email: string;
    phone?: string;
    password: string;
  }) =>
    request<{ accessToken: string; refreshToken: string; user: any; tenant: any }>(
      '/auth/register-tenant',
      { method: 'POST', body: JSON.stringify(data) },
    ),

  login: (data: { subdomain: string; email: string; password: string }) =>
    request<{ accessToken: string; refreshToken: string; user: any; tenant: any }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(data) },
    ),

  me: () => request<any>('/auth/me'),

  // ─── Vertical pack ────────────────────────────────────────────────────────
  getVerticalPack: () => request<any>('/vertical-pack'),

  // ─── Categories ──────────────────────────────────────────────────────────
  getCategories: () => request<any[]>('/categories'),
  createCategory: (data: { name: string; parentId?: string }) =>
    request<any>('/categories', { method: 'POST', body: JSON.stringify(data) }),

  // ─── Products ────────────────────────────────────────────────────────────
  getProducts: (params?: {
    search?: string;
    categoryId?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.search)     q.set('search', params.search);
    if (params?.categoryId) q.set('categoryId', params.categoryId);
    if (params?.page)       q.set('page', String(params.page));
    if (params?.limit)      q.set('limit', String(params.limit));
    return request<{ items: any[]; total: number; page: number; limit: number }>(
      `/products?${q}`,
    );
  },

  getProductByBarcode: (barcode: string) =>
    request<any>(`/products/barcode/${encodeURIComponent(barcode)}`),

  createProduct: (data: any) =>
    request<any>('/products', { method: 'POST', body: JSON.stringify(data) }),

  updateProduct: (id: string, data: any) =>
    request<any>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteProduct: (id: string) =>
    request<any>(`/products/${id}`, { method: 'DELETE' }),

  // ─── Customers ───────────────────────────────────────────────────────────
  getCustomers: (search?: string) => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<any[]>(`/customers${q}`);
  },
  createCustomer: (data: any) =>
    request<any>('/customers', { method: 'POST', body: JSON.stringify(data) }),

  // ─── Invoices ────────────────────────────────────────────────────────────
  createInvoice: (data: any) =>
    request<any>('/invoices', { method: 'POST', body: JSON.stringify(data) }),

  getInvoices: (page = 1) =>
    request<{ items: any[]; total: number }>(`/invoices?page=${page}`),

  // ─── Outlets ─────────────────────────────────────────────────────────────
  getOutlets: () => request<{ id: string; name: string; address: string | null; isDefault: boolean }[]>('/outlets'),

  // ─── Restaurant Tables ────────────────────────────────────────────────────
  getTables: () => request<any[]>('/restaurant/tables'),
  createTable: (data: { name: string; area?: string; capacity?: number }) =>
    request<any>('/restaurant/tables', { method: 'POST', body: JSON.stringify(data) }),
  updateTable: (id: string, data: any) =>
    request<any>(`/restaurant/tables/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTable: (id: string) => request<any>(`/restaurant/tables/${id}`, { method: 'DELETE' }),
  updateTableStatus: (id: string, status: string) =>
    request<any>(`/restaurant/tables/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // ─── Restaurant Orders ────────────────────────────────────────────────────
  getOrders: (status?: string, tableId?: string) => {
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    if (tableId) q.set('tableId', tableId);
    return request<any[]>(`/restaurant/orders?${q}`);
  },
  getOrder: (id: string) => request<any>(`/restaurant/orders/${id}`),
  createOrder: (data: any) =>
    request<any>('/restaurant/orders', { method: 'POST', body: JSON.stringify(data) }),
  closeOrder: (id: string, data: { status: string; invoiceId?: string }) =>
    request<any>(`/restaurant/orders/${id}/close`, { method: 'PATCH', body: JSON.stringify(data) }),
  setOrderComplementary: (id: string, data: { isComplementary: boolean; complementaryNote?: string }) =>
    request<any>(`/restaurant/orders/${id}/complementary`, { method: 'PATCH', body: JSON.stringify(data) }),
  applyOrderDiscount: (id: string, discount: number) =>
    request<any>(`/restaurant/orders/${id}/discount`, { method: 'PATCH', body: JSON.stringify({ discount }) }),
  transferTable: (orderId: string, tableId: string) =>
    request<any>(`/restaurant/orders/${orderId}/transfer/${tableId}`, { method: 'PATCH' }),
  getOrderBill: (id: string) => request<any>(`/restaurant/orders/${id}/bill`),
  createSplit: (orderId: string, data: { parts: any[] }) =>
    request<any[]>(`/restaurant/orders/${orderId}/split`, { method: 'POST', body: JSON.stringify(data) }),
  markSplitPaid: (splitId: string) =>
    request<any>(`/restaurant/split/${splitId}/paid`, { method: 'PATCH' }),

  // ─── KOT ─────────────────────────────────────────────────────────────────
  getKots: (params?: { tableId?: string; status?: string; orderId?: string; station?: string }) => {
    const q = new URLSearchParams();
    if (params?.tableId) q.set('tableId', params.tableId);
    if (params?.status) q.set('status', params.status);
    if (params?.orderId) q.set('orderId', params.orderId);
    if (params?.station) q.set('station', params.station);
    return request<any[]>(`/restaurant/kots?${q}`);
  },
  createKot: (data: any) =>
    request<any>('/restaurant/kots', { method: 'POST', body: JSON.stringify(data) }),
  updateKotStatus: (id: string, status: string) =>
    request<any>(`/restaurant/kots/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  cancelKot: (id: string) => request<any>(`/restaurant/kots/${id}`, { method: 'DELETE' }),

  // ─── Loyalty ─────────────────────────────────────────────────────────────
  getLoyaltyTiers: () => request<any>('/loyalty/tiers'),
  getLoyaltyAccounts: () => request<any[]>('/loyalty/accounts'),
  getLoyaltyAccount: (customerId: string) => request<any>(`/loyalty/${customerId}`),
  enrollLoyalty: (customerId: string) =>
    request<any>(`/loyalty/enroll/${customerId}`, { method: 'POST' }),
  getLoyaltyTransactions: (customerId: string) =>
    request<any[]>(`/loyalty/${customerId}/transactions`),
  earnPoints: (customerId: string, amount: number, referenceId?: string) =>
    request<any>(`/loyalty/${customerId}/earn`, { method: 'POST', body: JSON.stringify({ amount, referenceId }) }),
  redeemPoints: (customerId: string, points: number, referenceId?: string) =>
    request<any>(`/loyalty/${customerId}/redeem`, { method: 'POST', body: JSON.stringify({ points, referenceId }) }),
  adjustPoints: (customerId: string, points: number, notes?: string) =>
    request<any>(`/loyalty/${customerId}/adjust`, { method: 'POST', body: JSON.stringify({ points, notes }) }),

  // ─── Shifts ──────────────────────────────────────────────────────────────
  getCurrentShift: () => request<any>('/shifts/current'),
  getShifts: () => request<any[]>('/shifts'),
  openShift: (data: { openingCash: number; outletId?: string; notes?: string }) =>
    request<any>('/shifts/open', { method: 'POST', body: JSON.stringify(data) }),
  closeShift: (id: string, data: { closingCash: number; notes?: string }) =>
    request<any>(`/shifts/${id}/close`, { method: 'POST', body: JSON.stringify(data) }),

  // ─── Promotions (restaurant) ─────────────────────────────────────────────
  getPromotions: () => request<any[]>('/restaurant/promotions'),
  createPromotion: (data: any) =>
    request<any>('/restaurant/promotions', { method: 'POST', body: JSON.stringify(data) }),

  // ─── Stock ───────────────────────────────────────────────────────────────
  getStock: () => request<Record<string, number>>('/stock'),
  getStockList: () => request<{ productId: string; productName: string; sku: string | null; qty: number }[]>('/stock/list'),
  adjustStock: (data: { productId: string; qtyDelta: number; reason: string }) =>
    request<any>('/stock/adjust', { method: 'POST', body: JSON.stringify(data) }),

  // ─── Invoices (extended) ─────────────────────────────────────────────────
  getInvoiceByNumber: (number: string) =>
    request<any>(`/invoices/by-number/${encodeURIComponent(number)}`),
  getInvoiceById: (id: string) => request<any>(`/invoices/${encodeURIComponent(id)}`),

  // ─── Repair Jobs (job cards) ─────────────────────────────────────────────
  getRepairJobs: (status?: string) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<any[]>(`/mobile/repair-jobs${q}`);
  },
  createRepairJob: (data: any) =>
    request<any>('/mobile/repair-jobs', { method: 'POST', body: JSON.stringify(data) }),
  updateRepairJob: (id: string, data: any) =>
    request<any>(`/mobile/repair-jobs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // ─── Customers (extended) ────────────────────────────────────────────────
  updateCustomer: (id: string, data: any) =>
    request<any>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // ─── Suppliers ────────────────────────────────────────────────────────────
  getSuppliers: (search?: string) => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<any[]>(`/suppliers${q}`);
  },
  createSupplier: (data: any) =>
    request<any>('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: string, data: any) =>
    request<any>(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id: string) =>
    request<any>(`/suppliers/${id}`, { method: 'DELETE' }),

  // ─── Purchasing (PO & GRN) ───────────────────────────────────────────────
  getPurchaseOrders: () => request<any[]>('/purchasing/po'),
  createPurchaseOrder: (data: any) =>
    request<any>('/purchasing/po', { method: 'POST', body: JSON.stringify(data) }),
  getGrns: () => request<any[]>('/purchasing/grn'),
  createGrn: (data: any) =>
    request<any>('/purchasing/grn', { method: 'POST', body: JSON.stringify(data) }),

  // ─── Refunds ─────────────────────────────────────────────────────────────
  processRefund: (data: any) =>
    request<any>('/refunds', { method: 'POST', body: JSON.stringify(data) }),

  // ─── Warranty ────────────────────────────────────────────────────────────
  getWarrantyClaims: () => request<any[]>('/warranty'),
  createWarrantyClaim: (data: any) =>
    request<any>('/warranty', { method: 'POST', body: JSON.stringify(data) }),
  updateWarrantyStatus: (id: string, status: string) =>
    request<any>(`/warranty/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
};
