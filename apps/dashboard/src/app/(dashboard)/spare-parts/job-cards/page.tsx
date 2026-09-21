'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Superseded by the shared Repair Jobs workshop at /repairs (technician
// assignment, parts billing, checkout-to-invoice) — kept as a redirect so
// any bookmarked link still lands somewhere useful.
export default function JobCardsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/repairs');
  }, [router]);
  return null;
}
