import { getAccessToken } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function rpc<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Reports API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KpiToday {
  totalSales: number;
  totalTax: number;
  totalProfit: number;
  itemsSold: number;
  invoiceCount: number;
}

export interface SalesDayRow {
  date?: string;
  period?: string;
  totalSales: number;
  totalTax: number;
  totalProfit: number;
  itemsSold: number;
  invoiceCount: number;
}

export interface CashierRow {
  deviceId: string | null;
  deviceName: string;
  totalSales: number;
  invoiceCount: number;
}

export interface TopProductRow {
  productId: string;
  productName: string;
  sku: string;
  qtySold: number;
  revenue: number;
  profit: number;
}

export interface SlowMoverRow {
  productId: string;
  productName: string;
  sku: string | null;
  currentStock: number;
}

export interface StockValue {
  totalValue: number;
  totalQty: number;
  byCategory: {
    categoryName: string;
    totalQty: number;
    totalValue: number;
    productCount: number;
  }[];
}

export interface StockAlerts {
  lowStock: { productId: string; productName: string; sku: string | null; currentStock: number; threshold: number }[];
  deadStock: { productId: string; productName: string; sku: string | null; currentStock: number }[];
}

export interface TopCustomerRow {
  customerId: string;
  customerName: string;
  phone: string | null;
  totalSpent: number;
  invoiceCount: number;
  lastPurchase: string;
}

export interface Outlet {
  id: string;
  name: string;
  isDefault: boolean;
}

// ── Params helpers ────────────────────────────────────────────────────────────

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const reportApi = {
  getTodayKpi: (outletId?: string) =>
    rpc<KpiToday>(`/reports/kpi/today${qs({ outletId })}`),

  getSales: (from: string, to: string, outletId?: string, groupBy: 'day' | 'week' | 'month' = 'day') =>
    rpc<SalesDayRow[]>(`/reports/sales${qs({ from, to, outletId, groupBy })}`),

  getCashier: (from: string, to: string, outletId?: string) =>
    rpc<CashierRow[]>(`/reports/cashier${qs({ from, to, outletId })}`),

  getTopProducts: (from: string, to: string, metric: 'revenue' | 'qty' | 'profit' = 'revenue', limit = 10, outletId?: string) =>
    rpc<TopProductRow[]>(`/reports/products/top${qs({ from, to, metric, limit, outletId })}`),

  getSlowMovers: (days = 30, limit = 20) =>
    rpc<SlowMoverRow[]>(`/reports/products/slow${qs({ days, limit })}`),

  getStockValue: () => rpc<StockValue>('/reports/stock/value'),

  getStockAlerts: () => rpc<StockAlerts>('/reports/stock/alerts'),

  getTopCustomers: (from: string, to: string, limit = 10) =>
    rpc<TopCustomerRow[]>(`/reports/customers/top${qs({ from, to, limit })}`),

  refresh: (date?: string) =>
    rpc<{ jobId: string }>('/reports/refresh', { method: 'POST', body: JSON.stringify({ date }) }),

  exportUrl: (type: string, from: string, to: string, outletId?: string) =>
    `${BASE}/reports/export${qs({ type, from, to, outletId, format: 'csv' })}`,

  getOutlets: () =>
    rpc<Outlet[]>('/outlets'),
};

// ── Date helpers ──────────────────────────────────────────────────────────────

export function isoDate(d: Date = new Date()): string {
  return d.toISOString().split('T')[0];
}

export function thisWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay() || 7; // 1=Mon … 7=Sun
  const mon = new Date(now);
  mon.setDate(now.getDate() - day + 1);
  return { from: isoDate(mon), to: isoDate() };
}

export function thisMonthRange(): { from: string; to: string } {
  const now = new Date();
  return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: isoDate() };
}
