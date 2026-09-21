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

  if (res.status === 402) {
    // SubscriptionGuard's response — either the tenant's subscription itself
    // is suspended/trial-expired, or (a distinct case, same status code) a
    // specific route requires a paid add-on the tenant hasn't purchased.
    // Send each case to the page that can actually fix it, unless we're
    // already there (avoid a redirect loop).
    const requiresAddOn = typeof body?.message === 'string' && body.message.includes('requires a paid add-on');
    const target = requiresAddOn ? '/settings/addons' : '/account/subscription?reason=expired';
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith(target.split('?')[0])) {
      window.location.href = target;
    }
    throw new Error(body?.message ?? 'Subscription required');
  }

  if (!res.ok) throw new Error(body?.message ?? `HTTP ${res.status}`);
  return body as T;
}

/** Exported alias used by vertical.ts */
export const apiFetch = request;

/**
 * Multipart file upload — deliberately does NOT set Content-Type so the
 * browser can generate the correct multipart boundary itself; `request()`
 * always forces `application/json`, which would break a FormData body.
 */
async function uploadFile<T>(path: string, formData: FormData): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
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
    season?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.search)     q.set('search', params.search);
    if (params?.categoryId) q.set('categoryId', params.categoryId);
    if (params?.season)     q.set('season', params.season);
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

  // ─── Repair Jobs (phone/device repair workshop — paid add-on for Mobile
  //     Shop tenants, free/included for Spare Parts; see @RequiresModule
  //     ('repairs') on RepairsController) ──────────────────────────────────
  getRepairJobs: (status?: string, technicianId?: string) => {
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    if (technicianId) q.set('technicianId', technicianId);
    const qs = q.toString();
    return request<any[]>(`/repairs${qs ? `?${qs}` : ''}`);
  },
  getRepairJob: (id: string) => request<any>(`/repairs/${encodeURIComponent(id)}`),
  createRepairJob: (data: any) =>
    request<any>('/repairs', { method: 'POST', body: JSON.stringify(data) }),
  updateRepairJob: (id: string, data: any) =>
    request<any>(`/repairs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addRepairPart: (id: string, data: { productId: string; variantId?: string; qty: number; unitPrice?: number }) =>
    request<any>(`/repairs/${id}/parts`, { method: 'POST', body: JSON.stringify(data) }),
  removeRepairPart: (id: string, partId: string) =>
    request<any>(`/repairs/${id}/parts/${encodeURIComponent(partId)}`, { method: 'DELETE' }),
  checkoutRepairJob: (
    id: string,
    data: {
      outletId: string;
      customerId?: string;
      discount?: number;
      laborCharge?: number;
      payments: { method: string; amount: number }[];
    },
  ) => request<any>(`/repairs/${id}/checkout`, { method: 'POST', body: JSON.stringify(data) }),

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
  getBatches: (params?: { productId?: string; variantId?: string }) => {
    const q = new URLSearchParams();
    if (params?.productId) q.set('productId', params.productId);
    if (params?.variantId) q.set('variantId', params.variantId);
    return request<any[]>(`/purchasing/batches?${q}`);
  },

  // ─── Textile variants ────────────────────────────────────────────────────
  generateVariants: (data: { productId: string; sizes: string[]; colors: string[]; barcodePrefix?: string }) =>
    request<any[]>('/textile/generate-variants', { method: 'POST', body: JSON.stringify(data) }),
  listVariants: (productId: string) =>
    request<{ variants: any[]; matrix: { sizes: string[]; colors: string[] } }>(
      `/textile/variants/${encodeURIComponent(productId)}`,
    ),
  importVariantsCsv: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadFile<{ created: number; updated: number; errors: { row: number; sku: string; reason: string }[] }>(
      '/textile/variants/import',
      formData,
    );
  },
  exchangeVariant: (data: { invoiceItemId: string; toVariantId: string; qty: number }) =>
    request<{
      exchangeId: string;
      from: { variantId: string; qty: number };
      to: { variantId: string; qty: number };
      priceDifference: number;
      invoiceItem: any;
    }>('/textile/exchange', { method: 'POST', body: JSON.stringify(data) }),

  // ─── Notifications (WhatsApp / SMS) ──────────────────────────────────────
  getNotificationSettings: () => request<any>('/notifications/settings'),
  updateNotificationSettings: (data: any) =>
    request<any>('/notifications/settings', { method: 'PUT', body: JSON.stringify(data) }),
  sendNotification: (data: { channel: 'WHATSAPP' | 'SMS'; to: string; body: string; relatedInvoiceId?: string }) =>
    request<any>('/notifications/send', { method: 'POST', body: JSON.stringify(data) }),
  getMessageLogs: (page = 1) => request<{ items: any[]; total: number }>(`/notifications/logs?page=${page}`),

  // ─── POS settings (per outlet) ──────────────────────────────────────────
  getPosSettings: (outletId: string) =>
    request<{ outletId: string; posViewMode: 'MODERN' | 'TRADITIONAL' }>(`/outlets/${outletId}/settings`),
  updatePosSettings: (outletId: string, posViewMode: 'MODERN' | 'TRADITIONAL') =>
    request<{ outletId: string; posViewMode: 'MODERN' | 'TRADITIONAL' }>(`/outlets/${outletId}/settings`, {
      method: 'PUT',
      body: JSON.stringify({ posViewMode }),
    }),

  // ─── Refunds ─────────────────────────────────────────────────────────────
  processRefund: (data: any) =>
    request<any>('/refunds', { method: 'POST', body: JSON.stringify(data) }),

  // ─── Users (staff — e.g. Salesman picker) ───────────────────────────────
  getUsers: () => request<{ id: string; name: string; role: string }[]>('/users'),

  // ─── Devices (till registry for the web POS) ────────────────────────────
  registerDevice: (data: { name?: string; outletId?: string }) =>
    request<{ id: string; name: string; outletId: string }>('/devices', { method: 'POST', body: JSON.stringify(data) }),
  getDevice: (id: string) => request<{ id: string; name: string; outletId: string }>(`/devices/${id}`),
  renameDevice: (id: string, name: string) =>
    request<{ id: string; name: string; outletId: string }>(`/devices/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),

  // ─── Quotations ──────────────────────────────────────────────────────────
  getQuotations: () => request<any[]>('/quotations'),
  getQuotation: (id: string) => request<any>(`/quotations/${id}`),
  createQuotation: (data: any) =>
    request<any>('/quotations', { method: 'POST', body: JSON.stringify(data) }),
  updateQuotationStatus: (id: string, status: string) =>
    request<any>(`/quotations/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // ─── Held ("parked") sales ───────────────────────────────────────────────
  getHeldSales: () => request<any[]>('/held-sales'),
  holdSale: (data: { outletId?: string; customerId?: string; note?: string; cartSnapshot: any }) =>
    request<any>('/held-sales', { method: 'POST', body: JSON.stringify(data) }),
  deleteHeldSale: (id: string) =>
    request<any>(`/held-sales/${id}`, { method: 'DELETE' }),

  // ─── Cash drawer / expense / paid-out ────────────────────────────────────
  getCashMovements: (shiftId: string) => request<any[]>(`/shifts/${shiftId}/cash-movements`),
  addCashMovement: (shiftId: string, data: { type: 'DRAWER_OPEN' | 'PAID_IN' | 'PAID_OUT'; amount: number; reason?: string }) =>
    request<any>(`/shifts/${shiftId}/cash-movements`, { method: 'POST', body: JSON.stringify(data) }),

  // ─── Customer credit ─────────────────────────────────────────────────────
  setCustomerCreditLimit: (id: string, creditLimit: number | null) =>
    request<any>(`/customers/${id}/credit`, { method: 'PATCH', body: JSON.stringify({ creditLimit }) }),
  recordCreditPayment: (id: string, amount: number) =>
    request<any>(`/customers/${id}/credit-payments`, { method: 'POST', body: JSON.stringify({ amount }) }),

  // ─── Warranty ────────────────────────────────────────────────────────────
  getWarrantyClaims: () => request<{ items: any[]; total: number; page: number; limit: number }>('/warranty'),
  createWarrantyClaim: (data: any) =>
    request<any>('/warranty', { method: 'POST', body: JSON.stringify(data) }),
  updateWarrantyStatus: (id: string, status: string) =>
    request<any>(`/warranty/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // ─── Products (vertical attribute search) ───────────────────────────────
  searchProductsVertical: (query: string, limit = 8) =>
    request<any[]>(`/products/search?q=${encodeURIComponent(query)}&limit=${limit}`),

  // ─── Billing / Subscription ──────────────────────────────────────────────
  getPlans: (businessType?: string) =>
    request<any[]>(`/billing/plans${businessType ? `?businessType=${businessType}` : ''}`),
  getSubscription: () => request<any>('/billing/subscription'),
  getBillingHistory: () => request<any[]>('/billing/subscription/history'),
  createCheckout: (data: { gateway: 'STRIPE' | 'PAYPAL' | 'PAYHERE'; billingCycle: 'MONTHLY' | 'ANNUAL'; currency: 'USD' | 'LKR' }) =>
    request<{ redirectUrl: string; gatewayRef: string }>('/billing/subscription/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  cancelSubscription: () =>
    request<{ cancelled: boolean }>('/billing/subscription/cancel', { method: 'POST' }),

  // ─── Add-ons Store ───────────────────────────────────────────────────────
  getAddOns: () => request<any[]>('/billing/addons'),
  purchaseAddOn: (addOnModuleId: string, data: { gateway: 'STRIPE' | 'PAYPAL' | 'PAYHERE'; currency: 'USD' | 'LKR' }) =>
    request<{ redirectUrl: string; gatewayRef: string }>(`/billing/addons/${addOnModuleId}/checkout`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  cancelAddOn: (addOnModuleId: string) =>
    request<{ cancelled: boolean }>(`/billing/addons/${addOnModuleId}/cancel`, { method: 'POST' }),
};
