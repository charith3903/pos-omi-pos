import { VerticalPack } from '@omnipos/types';

export const RENTAL_PACK: VerticalPack = {
  businessType: 'RENTAL',

  labels: {
    product: 'Equipment',
    products: 'Equipment',
    sku: 'Equipment Code',
    barcode: 'Barcode',
    category: 'Category',
    searchPlaceholder: 'Search equipment…',
    receiptTitle: 'RENTAL AGREEMENT',
    addProduct: 'Add Equipment',
    noProducts: 'No equipment found',
    rateUnit: 'Rate Unit',
    deposit: 'Security Deposit',
  },

  productFields: [
    {
      key: 'rental_rate',
      label: 'Rental Rate',
      type: 'number',
      required: true,
      searchable: false,
      position: 1,
      placeholder: 'Rate per unit period',
    },
    {
      key: 'rate_unit',
      label: 'Rate Unit',
      type: 'select',
      required: true,
      searchable: false,
      position: 2,
      options: ['HOUR', 'DAY', 'WEEK', 'MONTH'],
    },
    {
      key: 'deposit',
      label: 'Security Deposit',
      type: 'number',
      required: false,
      searchable: false,
      position: 3,
      placeholder: 'Refundable deposit',
    },
    {
      key: 'min_rental_units',
      label: 'Minimum Rental Period',
      type: 'number',
      required: false,
      searchable: false,
      position: 4,
      placeholder: 'Minimum rental period',
    },
    {
      key: 'condition',
      label: 'Condition',
      type: 'select',
      required: false,
      searchable: false,
      position: 5,
      options: ['Excellent', 'Good', 'Fair', 'For-Repair'],
    },
  ],

  enabledModules: ['catalog', 'invoices', 'stock', 'rental'],
  defaultTaxRate: 0,
  receiptTemplate: 'rental',
  searchFilterKeys: [],
};
