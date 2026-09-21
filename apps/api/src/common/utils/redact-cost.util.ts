/**
 * "Cost Price Check" in the POS is deliberately gated to OWNER/MANAGER on
 * the client (apps/dashboard/.../GenericBilling.tsx) — but every endpoint
 * that returns a product/variant/batch also returns its raw `cost`/
 * `unitCost` to ANY authenticated role, so a cashier could just read it out
 * of the network tab. These helpers strip cost fields server-side for
 * anyone who isn't OWNER/MANAGER, so the UI gate is backed by a real one.
 */
export function canViewCost(role: string): boolean {
  return role === 'OWNER' || role === 'MANAGER';
}

/** Removes `cost` from a product and each of its variants, in place of a deep clone, for non-owner/manager roles. */
export function redactProductCost<T extends { cost?: unknown; variants?: { cost?: unknown }[] }>(
  product: T,
  role: string,
): T {
  if (canViewCost(role) || !product) return product;
  const { cost: _cost, ...rest } = product as Record<string, unknown>;
  return {
    ...rest,
    variants: product.variants?.map((v) => {
      const { cost: _vCost, ...vRest } = v as Record<string, unknown>;
      return vRest;
    }),
  } as T;
}

export function redactProductsCost<T extends { cost?: unknown; variants?: { cost?: unknown }[] }>(
  products: T[],
  role: string,
): T[] {
  if (canViewCost(role)) return products;
  return products.map((p) => redactProductCost(p, role));
}

/** Removes `unitCost` from each batch row for non-owner/manager roles. */
export function redactBatchCost<T extends { unitCost?: unknown }>(batches: T[], role: string): T[] {
  if (canViewCost(role)) return batches;
  return batches.map((b) => {
    const { unitCost: _unitCost, ...rest } = b as Record<string, unknown>;
    return rest as T;
  });
}
