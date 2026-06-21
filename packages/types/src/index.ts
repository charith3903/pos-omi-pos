// Shared domain types consumed by apps/api and apps/dashboard

// ─── Enums ───────────────────────────────────────────────────────────────────

export type BusinessType =
  | 'SPARE_PARTS'
  | 'RESTAURANT'
  | 'ELECTRICAL'
  | 'SUPERMARKET'
  | 'TEXTILE'
  | 'MOBILE'
  | 'RENTAL';

export type TenantPlan = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED';
export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER';

// ─── Domain models ───────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  businessType: BusinessType;
  plan: TenantPlan;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Outlet {
  id: string;
  tenantId: string;
  name: string;
  address?: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Device {
  id: string;
  tenantId: string;
  outletId: string;
  name: string;
  lastSyncAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role?: UserRole;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ─── API response wrappers ───────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}

// ─── Vertical pack system ────────────────────────────────────────────────────

export type VerticalFieldType = 'text' | 'number' | 'select' | 'boolean';

export interface VerticalField {
  key: string;
  label: string;
  type: VerticalFieldType;
  required: boolean;
  searchable: boolean;
  options?: string[];
  position: number;
  placeholder?: string;
}

export interface VerticalPack {
  businessType: BusinessType | 'DEFAULT';
  labels: {
    product: string;
    products: string;
    sku: string;
    barcode: string;
    category: string;
    searchPlaceholder: string;
    receiptTitle: string;
    [key: string]: string;
  };
  productFields: VerticalField[];
  enabledModules: string[];
  defaultTaxRate: number;
  receiptTemplate: 'standard' | 'spare_parts' | 'restaurant' | 'mobile' | 'rental';
  searchFilterKeys: string[];
}

// ─── Health ──────────────────────────────────────────────────────────────────

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  uptime: number;
  timestamp: string;
  services: {
    database: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
  };
}
