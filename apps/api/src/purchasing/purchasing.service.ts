import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PurchasingService {
  constructor(private prisma: PrismaService) {}

  async getPurchaseOrders(tenantId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: { supplier: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPurchaseOrder(tenantId: string, data: any) {
    const { supplierId, items, notes } = data;
    
    // Generate PO number
    const count = await this.prisma.purchaseOrder.count({ where: { tenantId } });
    const number = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    let total = 0;
    const poItems = items.map(item => {
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

    return this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId,
        number,
        total,
        notes,
        status: 'SENT',
        items: {
          create: poItems,
        },
      },
      include: { items: true, supplier: true },
    });
  }

  async getGrns(tenantId: string) {
    return this.prisma.goodsReceivedNote.findMany({
      where: { tenantId },
      include: { po: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createGrn(tenantId: string, data: any) {
    const { poId, items, notes } = data;
    
    const count = await this.prisma.goodsReceivedNote.count({ where: { tenantId } });
    const number = `GRN-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    const grnItems = items.map(item => ({
      tenantId,
      productId: item.productId,
      qty: item.qty,
    }));

    const grn = await this.prisma.goodsReceivedNote.create({
      data: {
        tenantId,
        poId,
        number,
        notes,
        status: 'COMPLETED',
        items: {
          create: grnItems,
        },
      },
      include: { items: true },
    });

    // Update PO status if linked
    if (poId) {
      await this.prisma.purchaseOrder.update({
        where: { id: poId },
        data: { status: 'COMPLETED' },
      });
    }

    // Process Stock Movements
    for (const item of items) {
      // Find the active store/outlet logic is skipped for brevity (assume 1 main store or stock globally)
      // If there's an outlet, you'd find the default one. For now, just create a general stock movement.
      
      const outlet = await this.prisma.outlet.findFirst({ where: { tenantId } });

      if (outlet) {
        await this.prisma.stockMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            reason: 'PURCHASE',
            qtyDelta: item.qty,
          },
        });
      }
    }

    return grn;
  }
}
