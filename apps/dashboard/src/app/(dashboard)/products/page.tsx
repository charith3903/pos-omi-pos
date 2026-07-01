'use client';

import { useBusinessType } from '@/hooks/useVerticalPack';
import RestaurantFood from './RestaurantFood';
import GenericProducts from './GenericProducts';

// Single catalogue entry point — restaurant tenants get the food-specific
// adding system (single item / portion-based / meal combo) instead of a
// separate "Menu" page duplicating the same underlying catalogue.
export default function ProductsPage() {
  const businessType = useBusinessType();

  if (businessType === 'RESTAURANT') {
    return <RestaurantFood />;
  }

  return <GenericProducts />;
}
