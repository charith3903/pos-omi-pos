import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const STOCK_TTL = 300; // 5 minutes

interface StockRow {
  product_id: string;
  variant_id: string | null;
  stock: string; // Prisma returns Decimal as string from $queryRaw
}

export interface SaleLineForStock {
  productId: string;
  variantId: string | null;
  qty: number;
  /** Cashier-picked batch to draw from first (POS batch picker). Optional — falls back to FIFO. */
  batchId?: string | null;
  trackStock: boolean;
}

export interface StockMovementInsert {
  tenantId: string;
  productId: string;
  variantId: string | null;
  batchId?: string;
  unitCost?: Prisma.Decimal | number | string;
  qtyDelta: number;
  reason: 'SALE';
  refId: string;
  deviceId?: string | null;
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

  /**
   * Current stock levels for ALL variants of a tenant (rows with no variant
   * excluded). Completes what `getAllStock()`'s doc comment already claims
   * to return (a `byVariant` breakdown) — kept as a separate cached map
   * instead, so `getAllStock()`'s existing product-keyed shape and callers
   * are undisturbed.
   */
  async getAllStockByVariant(tenantId: string): Promise<Record<string, number>> {
    const key = `stock:${tenantId}:allVariants`;
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);

    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.$queryRaw<StockRow[]>`
        SELECT product_id,
               variant_id,
               COALESCE(SUM(qty_delta), 0)::text AS stock
        FROM   stock_movements
        WHERE  tenant_id = current_setting('app.current_tenant', true)
          AND  variant_id IS NOT NULL
        GROUP  BY product_id, variant_id
      `,
    );

    const map: Record<string, number> = {};
    for (const row of rows) {
      if (!row.variant_id) continue;
      map[row.variant_id] = (map[row.variant_id] ?? 0) + parseFloat(row.stock);
    }

    await this.redis.setex(key, STOCK_TTL, JSON.stringify(map));
    return map;
  }

  /** Stock list with product names for the management UI. */
  async getStockList(tenantId: string): Promise<{ productId: string; productName: string; sku: string | null; qty: number }[]> {
    const stockMap = await this.getAllStock(tenantId);
    if (!Object.keys(stockMap).length) return [];

    const products = await this.prisma.withTenant(tenantId, (tx) =>
      tx.product.findMany({
        where: { id: { in: Object.keys(stockMap) }, trackStock: true },
        select: { id: true, name: true, sku: true },
      }),
    );

    return products.map((p) => ({
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      qty: stockMap[p.id] ?? 0,
    })).sort((a, b) => a.productName.localeCompare(b.productName));
  }

  /**
   * Deplete stock for a sale (invoice items), batch-aware:
   *  - If a line carries `batchId` (cashier picked a specific batch in the
   *    POS batch picker), that batch is drawn from first.
   *  - Any remaining qty (no batch picked, or the picked batch didn't have
   *    enough) is drawn FIFO — oldest `grn.createdAt` first — across the
   *    tenant's other batches for that product/variant.
   *  - Any qty still remaining after all batches are exhausted falls back to
   *    an unbatched movement (legacy stock / manual adjustments with no GRN
   *    history) — same as the pre-existing behaviour.
   *
   * Shared by the online invoice-create path (InvoicesService) and the
   * offline sync-push path (SyncService) so both deplete batches identically
   * — previously only the online path did this at all.
   *
   * Returns the movement rows to insert; does NOT insert them (callers batch
   * this together with their other writes in the same transaction) but DOES
   * decrement `qtyRemaining` on every batch drawn from, since that must
   * happen inside the same transaction as the movements it produces.
   */
  async consumeStockForSale(
    tx: Prisma.TransactionClient,
    tenantId: string,
    lines: SaleLineForStock[],
    ctx: { refId: string; deviceId?: string | null },
  ): Promise<StockMovementInsert[]> {
    const movements: StockMovementInsert[] = [];

    for (const line of lines) {
      if (!line.trackStock) continue;
      let remaining = Number(line.qty);
      const consumedBatchIds = new Set<string>();

      // ── Cashier-picked batch first ────────────────────────────────────
      if (line.batchId) {
        const picked = await tx.goodsReceivedNoteItem.findFirst({
          where: {
            id: line.batchId,
            tenantId,
            productId: line.productId,
            variantId: line.variantId,
            qtyRemaining: { gt: 0 },
          },
        });
        if (picked) {
          const deduct = Math.min(remaining, Number(picked.qtyRemaining));
          await tx.goodsReceivedNoteItem.update({
            where: { id: picked.id },
            data: { qtyRemaining: { decrement: deduct } },
          });
          movements.push({
            tenantId,
            productId: line.productId,
            variantId: line.variantId,
            batchId: picked.id,
            unitCost: picked.unitCost,
            qtyDelta: -deduct,
            reason: 'SALE',
            refId: ctx.refId,
            deviceId: ctx.deviceId ?? null,
          });
          consumedBatchIds.add(picked.id);
          remaining -= deduct;
        }
      }

      // ── FIFO for whatever's left ───────────────────────────────────────
      if (remaining > 0) {
        const batches = await tx.goodsReceivedNoteItem.findMany({
          where: {
            tenantId,
            productId: line.productId,
            variantId: line.variantId,
            qtyRemaining: { gt: 0 },
          },
          orderBy: { grn: { createdAt: 'asc' } },
        });

        for (const batch of batches) {
          if (remaining <= 0) break;
          if (consumedBatchIds.has(batch.id)) continue;
          const deduct = Math.min(remaining, Number(batch.qtyRemaining));
          await tx.goodsReceivedNoteItem.update({
            where: { id: batch.id },
            data: { qtyRemaining: { decrement: deduct } },
          });
          movements.push({
            tenantId,
            productId: line.productId,
            variantId: line.variantId,
            batchId: batch.id,
            unitCost: batch.unitCost,
            qtyDelta: -deduct,
            reason: 'SALE',
            refId: ctx.refId,
            deviceId: ctx.deviceId ?? null,
          });
          remaining -= deduct;
        }
      }

      // ── No batch history left (or none at all) — unbatched movement ────
      if (remaining > 0) {
        movements.push({
          tenantId,
          productId: line.productId,
          variantId: line.variantId,
          qtyDelta: -remaining,
          reason: 'SALE',
          refId: ctx.refId,
          deviceId: ctx.deviceId ?? null,
        });
      }
    }

    return movements;
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
