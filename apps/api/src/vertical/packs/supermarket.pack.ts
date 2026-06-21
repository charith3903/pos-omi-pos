import { VerticalPack } from '@omnipos/types';

export const SUPERMARKET_PACK: VerticalPack = {
  businessType: 'SUPERMARKET',

  labels: {
    product: 'Item',
    products: 'Items',
    sku: 'Item Code',
    barcode: 'Barcode / MRP Tag',
    category: 'Category',
    searchPlaceholder: 'Scan barcode or search…',
    receiptTitle: 'CASH RECEIPT',
    addProduct: 'Add Item',
    noProducts: 'No items found',
  },

  productFields: [
    {
      key: 'mrp',
      label: 'MRP',
      type: 'number',
      required: false,
      searchable: false,
      position: 1,
    },
    {
      key: 'expiry_date',
      label: 'Expiry Date',
      type: 'text',
      required: false,
      searchable: false,
      position: 2,
      placeholder: 'YYYY-MM-DD',
    },
    {
      key: 'weight_unit',
      label: 'Weight / Unit',
      type: 'select',
      required: false,
      searchable: false,
      position: 3,
      options: ['KG', 'G', 'L', 'ML', 'Unit'],
    },
    {
      key: 'is_weighed',
      label: 'Weighed Item',
      type: 'boolean',
      required: false,
      searchable: false,
      position: 4,
    },
    {
      key: 'min_stock_alert',
      label: 'Min Stock Alert',
      type: 'number',
      required: false,
      searchable: false,
      position: 5,
    },
    {
      key: 'batch_number',
      label: 'Batch Number',
      type: 'text',
      required: false,
      searchable: false,
      position: 6,
    },
    {
      key: 'country_of_origin',
      label: 'Country of Origin',
      type: 'text',
      required: false,
      searchable: false,
      position: 7,
    },
  ],

  enabledModules: ['catalog', 'invoices', 'stock', 'promotions'],
  defaultTaxRate: 0,
  receiptTemplate: 'standard',
  searchFilterKeys: [],
};
