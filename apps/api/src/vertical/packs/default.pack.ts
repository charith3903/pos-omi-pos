import { VerticalPack } from '@omnipos/types';

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
