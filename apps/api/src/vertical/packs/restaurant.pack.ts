import { VerticalPack } from '@omnipos/types';

export const RESTAURANT_PACK: VerticalPack = {
  businessType: 'RESTAURANT',

  labels: {
    product: 'Menu Item',
    products: 'Menu',
    sku: 'Item Code',
    barcode: 'Barcode',
    category: 'Course / Category',
    searchPlaceholder: 'Search menu…',
    receiptTitle: 'ORDER RECEIPT',
    addProduct: 'Add to Order',
    noProducts: 'No items found',
    table: 'Table',
    orderType: 'Order Type',
    modifiers: 'Modifiers',
  },

  productFields: [
    {
      key: 'prep_time_minutes',
      label: 'Prep Time (min)',
      type: 'number',
      required: false,
      searchable: false,
      position: 1,
    },
    {
      key: 'allergens',
      label: 'Allergens',
      type: 'text',
      required: false,
      searchable: false,
      position: 2,
      placeholder: 'e.g. Nuts, Dairy, Gluten',
    },
    {
      key: 'is_vegetarian',
      label: 'Vegetarian',
      type: 'boolean',
      required: false,
      searchable: false,
      position: 3,
    },
    {
      key: 'is_vegan',
      label: 'Vegan',
      type: 'boolean',
      required: false,
      searchable: false,
      position: 4,
    },
    {
      key: 'spice_level',
      label: 'Spice Level',
      type: 'select',
      required: false,
      searchable: false,
      position: 5,
      options: ['Mild', 'Medium', 'Hot', 'Extra Hot'],
    },
    {
      key: 'available_for',
      label: 'Available For',
      type: 'select',
      required: false,
      searchable: false,
      position: 6,
      options: ['Dine-In', 'Takeaway', 'Delivery', 'All'],
    },
  ],

  enabledModules: ['catalog', 'invoices', 'kitchen', 'tables'],
  defaultTaxRate: 0,
  receiptTemplate: 'restaurant',
  searchFilterKeys: [],
};
