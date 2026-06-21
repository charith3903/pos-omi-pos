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

/** Quick helper — reads businessType from session (no API call). */
export function useBusinessType(): string {
  if (typeof window === 'undefined') return '';
  return getSession()?.tenant?.businessType ?? '';
}

export function isSparePartsStore(): boolean {
  if (typeof window === 'undefined') return false;
  return getSession()?.tenant?.businessType === 'SPARE_PARTS';
}
