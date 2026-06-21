import type { VerticalPack } from '@omnipos/types';
import { apiFetch } from './api';

export type { VerticalField, VerticalPack } from '@omnipos/types';

const CACHE_KEY = 'omnipos_vertical_pack';

export async function fetchVerticalPack(): Promise<VerticalPack> {
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) return JSON.parse(cached) as VerticalPack;

  const pack = await apiFetch<VerticalPack>('/vertical-pack');
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(pack));
  return pack;
}

export function clearPackCache() {
  sessionStorage.removeItem(CACHE_KEY);
}

export function label(pack: VerticalPack, key: string, fallback?: string): string {
  return pack.labels[key] ?? fallback ?? key;
}

// Default pack used before the API responds (prevents layout shift)
export const DEFAULT_PACK: VerticalPack = {
  businessType: 'DEFAULT',
  labels: {
    product: 'Product',
    products: 'Products',
    sku: 'SKU',
    barcode: 'Barcode',
    category: 'Category',
    searchPlaceholder: 'Search by name, SKU or barcode…',
    receiptTitle: 'RECEIPT',
    addProduct: 'Add Product',
    noProducts: 'No products found',
  },
  productFields: [],
  enabledModules: ['catalog', 'invoices', 'stock'],
  defaultTaxRate: 0,
  receiptTemplate: 'standard',
  searchFilterKeys: [],
};
