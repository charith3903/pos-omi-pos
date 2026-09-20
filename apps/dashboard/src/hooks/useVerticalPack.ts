'use client';

import { useEffect, useState } from 'react';
import { fetchVerticalPack, DEFAULT_PACK, type VerticalPack } from '@/lib/vertical';
import { getSession } from '@/lib/auth';

export function useVerticalPack() {
  const [pack, setPack] = useState<VerticalPack>(DEFAULT_PACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVerticalPack()
      .then(setPack)
      .catch(() => setPack(DEFAULT_PACK))
      .finally(() => setLoading(false));
  }, []);

  return { pack, loading };
}

/**
 * Quick helper — reads businessType from session (no API call).
 *
 * Returns '' on the very first render on both server and client (matching,
 * so nothing hydration-mismatches), then fills in the real value from
 * localStorage after mount. Callers that branch to entirely different
 * component trees per business type (e.g. BillingPage picking RestaurantPOS
 * vs GenericBilling) will render their '' branch for one frame before
 * swapping — expected and harmless, unlike reading localStorage directly
 * during render, which desyncs the server and client trees outright and
 * forces React to discard and rebuild the whole subtree.
 */
export function useBusinessType(): string {
  const [businessType, setBusinessType] = useState('');
  useEffect(() => {
    setBusinessType(getSession()?.tenant?.businessType ?? '');
  }, []);
  return businessType;
}

export function useIsSparePartsStore(): boolean {
  return useBusinessType() === 'SPARE_PARTS';
}
