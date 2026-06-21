import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RefundsService {
  constructor(private prisma: PrismaService) {}

  async processRefund(tenantId: string, data: any) {
    const { invoiceId, items, restock } = data; // items: [{ invoiceItemId, qtyToRefund }]

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { items: true },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    let refundTotal = 0;

    for (const refundItem of items) {
      const invItem = invoice.items.find(i => i.id === refundItem.invoiceItemId);
      if (!invItem) continue;

      refundTotal += Number(invItem.unitPrice) * refundItem.qtyToRefund;

      if (restock) {
        await this.prisma.stockMovement.create({
          data: {
            tenantId,
            productId: invItem.productId,
            reason: 'RETURN',
            qtyDelta: refundItem.qtyToRefund,
          },
        });
      }
    }

    // Determine status (PARTIAL_REFUND vs REFUNDED)
    // Simplified logic: if returning any items, mark as PARTIAL_REFUND. 
    // If returning all qty for all items, mark REFUNDED.
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PARTIAL_REFUND' },
    });

    // Create a negative invoice record to represent the refund
    const { v4: uuidv4 } = require('uuid');
    const refundInvoice = await this.prisma.invoice.create({
      data: {
        id: uuidv4(),
        tenantId,
        outletId: invoice.outletId,
        customerId: invoice.customerId,
        number: `REF-${invoice.number}`,
        status: 'REFUNDED',
        subtotal: -refundTotal,
        total: -refundTotal,
        items: {
          create: items.map((item: any) => {
            const invItem = invoice.items.find((i: any) => i.id === item.invoiceItemId);
            return {
              id: uuidv4(),
              tenantId,
              productId: invItem!.productId,
              qty: item.qtyToRefund,
              nameSnapshot: invItem!.nameSnapshot,
              unitPrice: invItem!.unitPrice,
              lineTotal: -(Number(invItem!.unitPrice) * item.qtyToRefund),
            };
          }),
        },
      },
    });

    return refundInvoice;
  }
}
