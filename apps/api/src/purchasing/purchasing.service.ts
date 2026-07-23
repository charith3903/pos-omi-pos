import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

interface GrnItemInput {
  productId: string;
  variantId?: string;
  qty: number;
  unitCost: number;
  sellingPrice?: number;
  batchNo?: string;
  expiryDate?: string;
}

@Injectable()
export class PurchasingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getPurchaseOrders(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.purchaseOrder.findMany({
        where: { tenantId },
        include: { supplier: true, items: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async createPurchaseOrder(tenantId: string, data: any) {
    const { supplierId, items, notes } = data;

    return this.prisma.withTenant(tenantId, async (tx) => {
      const count = await tx.purchaseOrder.count({ where: { tenantId } });
      const number = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

      let total = 0;
      const poItems = items.map((item) => {
        const lineTotal = item.qty * item.unitPrice;
        total += lineTotal;
        return {
          tenantId,
          productId: item.productId,
          qty: item.qty,
          unitPrice: item.unitPrice,
          total: lineTotal,
        };
      });

      return tx.purchaseOrder.create({
        data: {
          tenantId,
          supplierId,
          number,
          total,
          notes,
          status: 'SENT',
          items: { create: poItems },
        },
        include: { items: true, supplier: true },
      });
    });
  }

  async getGrns(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.goodsReceivedNote.findMany({
        where: { tenantId },
        include: {
          po: true,
          items: { include: { product: true, variant: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  /**
   * Each item IS a batch: carries its own cost/selling price/expiry and
   * starts with qtyRemaining = qty. Stock movements reference the batch
   * (batchId) so FIFO depletion and margin/COGS reporting both work off the
   * same ledger. If an item sets sellingPrice, that becomes the product's
   * (or variant's) new active price — the "newest batch sets the price"
   * behaviour confirmed for this vertical.
   */
  async createGrn(tenantId: string, data: { poId?: string; notes?: string; items: GrnItemInput[] }) {
    const { poId, items, notes } = data;
    if (!items?.length) throw new NotFoundException('At least one item is required');

    const grn = await this.prisma.withTenant(tenantId, async (tx) => {
      const count = await tx.goodsReceivedNote.count({ where: { tenantId } });
      const number = `GRN-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

      const outlet = await tx.outlet.findFirst({ where: { tenantId } });

      const created = await tx.goodsReceivedNote.create({
        data: {
          tenantId,
          poId,
          number,
          notes,
          status: 'COMPLETED',
          items: {
            create: items.map((item, i) => ({
              tenantId,
              productId: item.productId,
              variantId: item.variantId ?? null,
              qty: item.qty,
              qtyRemaining: item.qty,
              batchNo: item.batchNo?.trim() || `${number}-${i + 1}`,
              unitCost: item.unitCost,
              sellingPrice: item.sellingPrice ?? null,
              expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            })),
          },
        },
        include: { items: true },
      });

      if (poId) {
        await tx.purchaseOrder.update({ where: { id: poId }, data: { status: 'COMPLETED' } });
      }

      if (outlet) {
        await tx.stockMovement.createMany({
          data: created.items.map((grnItem) => ({
            tenantId,
            productId: grnItem.productId,
            variantId: grnItem.variantId,
            batchId: grnItem.id,
            unitCost: grnItem.unitCost,
            reason: 'PURCHASE' as const,
            qtyDelta: grnItem.qty,
            refId: created.id,
          })),
        });
      }

      // New batch's selling price becomes the active price for the product/variant.
      for (const grnItem of created.items) {
        if (grnItem.sellingPrice == null) continue;
        if (grnItem.variantId) {
          await tx.productVariant.update({
            where: { id: grnItem.variantId },
            data: { price: grnItem.sellingPrice },
          });
        } else {
          await tx.product.update({
            where: { id: grnItem.productId },
            data: { price: grnItem.sellingPrice },
          });
        }
      }

      return created;
    });

    await Promise.allSettled([
      ...items.map((item) => this.redis.del(`stock:${tenantId}:${item.productId}`)),
      this.redis.del(`stock:${tenantId}:all`),
    ]);

    return grn;
  }

  /** Batches with remaining qty, oldest-received-first (FIFO). */
  async getBatches(tenantId: string, productId?: string, variantId?: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.goodsReceivedNoteItem.findMany({
        where: {
          tenantId,
          qtyRemaining: { gt: 0 },
          ...(productId ? { productId } : {}),
          ...(variantId ? { variantId } : {}),
        },
        include: { product: { select: { id: true, name: true, sku: true } }, variant: true, grn: true },
        orderBy: { grn: { createdAt: 'asc' } },
      }),
    );
  }

  /** Oldest remaining batch's selling price (FIFO), else the product/variant's own price. */
  async getEffectivePrice(tenantId: string, productId: string, variantId?: string | null): Promise<number | null> {
    const batch = await this.prisma.withTenant(tenantId, (tx) =>
      tx.goodsReceivedNoteItem.findFirst({
        where: {
          tenantId,
          productId,
          variantId: variantId ?? null,
          qtyRemaining: { gt: 0 },
          sellingPrice: { not: null },
        },
        orderBy: { grn: { createdAt: 'asc' } },
        select: { sellingPrice: true },
      }),
    );
    return batch?.sellingPrice != null ? Number(batch.sellingPrice) : null;
  }
}
