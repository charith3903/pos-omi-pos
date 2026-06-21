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

export const api = {
  // ─── Auth ────────────────────────────────────────────────────────────────
  login: (data: { subdomain: string; email: string; password: string }) =>
    request<{ accessToken: string; refreshToken: string; user: any; tenant: any }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(data) },
    ),

  me: () => request<any>('/auth/me'),

  // ─── Categories ──────────────────────────────────────────────────────────
  getCategories: () => request<any[]>('/categories'),
  createCategory: (data: { name: string; parentId?: string }) =>
    request<any>('/categories', { method: 'POST', body: JSON.stringify(data) }),

  // ─── Products ────────────────────────────────────────────────────────────
  getProducts: (params?: { search?: string; categoryId?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.categoryId) q.set('categoryId', params.categoryId);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
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

  // ─── Stock ───────────────────────────────────────────────────────────────
  getStock: () => request<Record<string, number>>('/stock'),
};
