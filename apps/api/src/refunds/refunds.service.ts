import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProcessRefundDto } from './dto/process-refund.dto';

@Injectable()
export class RefundsService {
  constructor(private readonly prisma: PrismaService) {}

  async processRefund(tenantId: string, dto: ProcessRefundDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: dto.invoiceId, tenantId },
        include: { items: true },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');

      let refundTotal = 0;
      const refundItemsData: {
        tenantId: string;
        productId: string;
        variantId: string | null;
        qty: number;
        nameSnapshot: string;
        unitPrice: number;
        lineTotal: number;
      }[] = [];

      for (const refundItem of dto.items) {
        const invItem = invoice.items.find((i) => i.id === refundItem.invoiceItemId);
        if (!invItem) throw new BadRequestException(`Invoice item ${refundItem.invoiceItemId} not found on this invoice`);

        const alreadyRefunded = Number(invItem.refundedQty);
        const remaining = Number(invItem.qty) - alreadyRefunded;
        if (refundItem.qtyToRefund > remaining) {
          throw new BadRequestException(
            `Cannot refund ${refundItem.qtyToRefund} of "${invItem.nameSnapshot}" — only ${remaining} remaining`,
          );
        }

        refundTotal += Number(invItem.unitPrice) * refundItem.qtyToRefund;

        await tx.invoiceItem.update({
          where: { id: invItem.id },
          data: { refundedQty: alreadyRefunded + refundItem.qtyToRefund },
        });

        refundItemsData.push({
          tenantId,
          productId: invItem.productId,
          variantId: invItem.variantId,
          qty: refundItem.qtyToRefund,
          nameSnapshot: invItem.nameSnapshot,
          unitPrice: Number(invItem.unitPrice),
          lineTotal: -(Number(invItem.unitPrice) * refundItem.qtyToRefund),
        });

        if (dto.restock) {
          await tx.stockMovement.create({
            data: {
              tenantId,
              productId: invItem.productId,
              variantId: invItem.variantId,
              reason: 'RETURN',
              qtyDelta: refundItem.qtyToRefund,
            },
          });
        }
      }

      // Full return = every item on the original invoice has now had its
      // entire qty refunded (across this call and any prior partial ones).
      const fullyRefunded = invoice.items.every((i) => {
        const thisCall = dto.items.find((r) => r.invoiceItemId === i.id);
        const refundedAfter = Number(i.refundedQty) + (thisCall?.qtyToRefund ?? 0);
        return refundedAfter >= Number(i.qty);
      });

      await tx.invoice.update({
        where: { id: dto.invoiceId },
        data: { status: fullyRefunded ? 'REFUNDED' : 'PARTIAL_REFUND' },
      });

      // A negative invoice record represents the refund itself (for reporting/receipts).
      const refundInvoice = await tx.invoice.create({
        data: {
          id: randomUUID(),
          tenantId,
          outletId: invoice.outletId,
          customerId: invoice.customerId,
          number: `REF-${invoice.number}`,
          status: 'REFUNDED',
          subtotal: -refundTotal,
          total: -refundTotal,
          items: { create: refundItemsData },
        },
        include: { items: true },
      });

      return refundInvoice;
    });
  }
}
