import { VerticalPack } from '@omnipos/types';

export const TEXTILE_PACK: VerticalPack = {
  businessType: 'TEXTILE',

  labels: {
    product: 'Style',
    products: 'Styles',
    sku: 'Style Code',
    barcode: 'Variant Barcode',
    category: 'Collection',
    searchPlaceholder: 'Search by style code, name…',
    receiptTitle: 'SALES RECEIPT',
    addProduct: 'Add Style',
    noProducts: 'No styles found',
  },

  productFields: [
    {
      key: 'style_code',
      label: 'Style Code',
      type: 'text',
      required: true,
      searchable: true,
      position: 1,
      placeholder: 'e.g. TS-2024-001',
    },
    {
      key: 'fabric',
      label: 'Fabric',
      type: 'select',
      required: false,
      searchable: false,
      position: 2,
      options: ['Cotton', 'Polyester', 'Silk', 'Linen', 'Wool', 'Denim', 'Blend', 'Other'],
    },
    {
      key: 'season',
      label: 'Season',
      type: 'select',
      required: false,
      searchable: false,
      position: 3,
      options: ['SS24', 'AW24', 'SS25', 'AW25', 'All-Season'],
    },
    {
      key: 'fit',
      label: 'Fit',
      type: 'select',
      required: false,
      searchable: false,
      position: 4,
      options: ['Regular', 'Slim', 'Loose', 'Oversized', 'Relaxed'],
    },
    {
      key: 'care_instructions',
      label: 'Care Instructions',
      type: 'text',
      required: false,
      searchable: false,
      position: 5,
    },
    {
      key: 'country_of_origin',
      label: 'Country of Origin',
      type: 'text',
      required: false,
      searchable: false,
      position: 6,
    },
  ],

  enabledModules: ['catalog', 'invoices', 'stock', 'variants'],
  defaultTaxRate: 0,
  receiptTemplate: 'standard',
  searchFilterKeys: ['style_code'],
};
