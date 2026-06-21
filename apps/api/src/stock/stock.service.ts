import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const STOCK_TTL = 300; // 5 minutes

interface StockRow {
  product_id: string;
  variant_id: string | null;
  stock: string; // Prisma returns Decimal as string from $queryRaw
}

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Current stock for a single product (all variants combined).
   * Tries Redis first; falls back to ledger SUM and re-caches.
   */
  async getProductStock(tenantId: string, productId: string): Promise<number> {
    const key = `stock:${tenantId}:${productId}`;
    const cached = await this.redis.get(key);
    if (cached !== null) return parseFloat(cached);

    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.$queryRaw<StockRow[]>`
        SELECT product_id,
               variant_id,
               COALESCE(SUM(qty_delta), 0)::text AS stock
        FROM   stock_movements
        WHERE  tenant_id  = current_setting('app.current_tenant', true)
          AND  product_id = ${productId}
        GROUP  BY product_id, variant_id
      `,
    );

    const total = rows.reduce((acc, r) => acc + parseFloat(r.stock), 0);
    await this.redis.setex(key, STOCK_TTL, total.toString());
    return total;
  }

  /**
   * Current stock levels for ALL products of a tenant.
   * Returns a map: { [productId]: { total, byVariant: { [variantId|null]: qty } } }
   * Cached under a single tenant-level key for 5 minutes.
   */
  async getAllStock(tenantId: string): Promise<Record<string, number>> {
    const key = `stock:${tenantId}:all`;
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);

    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.$queryRaw<StockRow[]>`
        SELECT product_id,
               variant_id,
               COALESCE(SUM(qty_delta), 0)::text AS stock
        FROM   stock_movements
        WHERE  tenant_id = current_setting('app.current_tenant', true)
        GROUP  BY product_id, variant_id
      `,
    );

    // Aggregate per product (sum across all variants)
    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row.product_id] = (map[row.product_id] ?? 0) + parseFloat(row.stock);
    }

    await this.redis.setex(key, STOCK_TTL, JSON.stringify(map));
    return map;
  }

  /** Record a manual stock adjustment (positive = receive, negative = write-off). */
  async adjust(
    tenantId: string,
    productId: string,
    variantId: string | null,
    qtyDelta: number,
    reason: 'ADJUSTMENT' | 'PURCHASE' | 'RETURN' | 'DAMAGE' | 'TRANSFER',
    refId?: string,
  ) {
    await this.prisma.withTenant(tenantId, (tx) =>
      tx.stockMovement.create({
        data: { tenantId, productId, variantId, qtyDelta, reason, refId },
      }),
    );

    // Bust caches
    await Promise.allSettled([
      this.redis.del(`stock:${tenantId}:${productId}`),
      this.redis.del(`stock:${tenantId}:all`),
    ]);
  }
}
