'use client';

import { Suspense } from 'react';
import { useBusinessType } from '@/hooks/useVerticalPack';
import RestaurantPOS from './RestaurantPOS';
import GenericBilling from './GenericBilling';

// Single POS entry point — the fields and flow (KOT firing, table/order
// context, split bill vs. simple cart + checkout) are chosen by the
// tenant's business type instead of exposing separate pages per vertical.
export default function BillingPage() {
  const businessType = useBusinessType();

  if (businessType === 'RESTAURANT') {
    return (
      <Suspense fallback={null}>
        <RestaurantPOS />
      </Suspense>
    );
  }

  return <GenericBilling />;
}
