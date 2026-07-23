import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

const INVOICE_INCLUDE = {
  items: { include: { product: { select: { id: true, name: true } } } },
  payments: true,
  customer: { select: { id: true, name: true, phone: true } },
  outlet: { select: { id: true, name: true } },
} as const;

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Create (idempotent) ────────────────────────────────────────────────
  //
  // The client provides a UUID (generated on the device before going online).
  // If this UUID has already been stored, we return the existing invoice
  // without side-effects — safe to retry on network failure.

  async create(tenantId: string, dto: CreateInvoiceDto) {
    const invoice = await this.prisma.withTenant(tenantId, async (tx) => {
      // ── Idempotency guard ─────────────────────────────────────────────
      const existing = await tx.invoice.findUnique({
        where: { id: dto.id },
        include: INVOICE_INCLUDE,
      });
      if (existing) return existing;

      // ── Sequential invoice number (atomic upsert + row-lock) ──────────
      // The INSERT … ON CONFLICT … RETURNING gives us an atomic increment
      // without a separate SELECT, safe under concurrent writes from
      // multiple POS devices to the same tenant.
      const counterRows = await tx.$queryRaw<[{ last_num: number }]>`
        INSERT INTO invoice_counters (tenant_id, last_num)
        VALUES (current_setting('app.current_tenant', true), 1)
        ON CONFLICT (tenant_id)
        DO UPDATE SET last_num = invoice_counters.last_num + 1
        RETURNING last_num
      `;
      const seq = counterRows[0].last_num;
      const year = new Date().getFullYear();
      const number = `INV-${year}-${String(seq).padStart(6, '0')}`;

      // ── Fetch products for name snapshots (validates tenant ownership) ─
      const productIds = [...new Set(dto.items.map((i) => i.productId))];
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, trackStock: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      // ── Write invoice ─────────────────────────────────────────────────
      const invoice = await tx.invoice.create({
        data: {
          id: dto.id,
          tenantId,
          outletId: dto.outletId,
          deviceId: dto.deviceId,
          number,
          customerId: dto.customerId,
          subtotal: dto.subtotal,
          discount: dto.discount ?? 0,
          tax: dto.tax ?? 0,
          total: dto.total,
          status: 'PAID',
          syncStatus: 'SYNCED',
        },
      });

      // ── Write items ───────────────────────────────────────────────────
      await tx.invoiceItem.createMany({
        data: dto.items.map((item) => ({
          tenantId,
          invoiceId: invoice.id,
          productId: item.productId,
          variantId: item.variantId ?? null,
          nameSnapshot: productMap.get(item.productId)?.name ?? item.nameSnapshot,
          qty: item.qty,
          unitPrice: item.unitPrice,
          discount: item.discount ?? 0,
          tax: item.tax ?? 0,
          lineTotal: item.lineTotal,
        })),
      });

      // ── Write payments ────────────────────────────────────────────────
      await tx.payment.createMany({
        data: dto.payments.map((p) => ({
          tenantId,
          invoiceId: invoice.id,
          method: p.method,
          amount: p.amount,
          reference: p.reference ?? null,
        })),
      });

      // ── Write stock movements (append-only ledger) ────────────────────
      // Negative delta = stock out (sale). Depletes the oldest remaining
      // batch(es) first (FIFO) so batch stock levels and per-batch cost stay
      // accurate — a sale can span more than one batch if it outlasts the
      // oldest one's remaining qty. Items with no batch history (manual
      // stock, or GRN predates batch tracking) fall back to an unbatched
      // movement, same as before.
      const movementData: {
        tenantId: string;
        productId: string;
        variantId: string | null;
        batchId?: string;
        unitCost?: any;
        qtyDelta: number;
        reason: 'SALE';
        refId: string;
        deviceId: string | null;
      }[] = [];

      for (const item of dto.items) {
        if (!productMap.get(item.productId)?.trackStock) continue;
        let remaining = Number(item.qty);

        const batches = await tx.goodsReceivedNoteItem.findMany({
          where: {
            tenantId,
            productId: item.productId,
            variantId: item.variantId ?? null,
            qtyRemaining: { gt: 0 },
          },
          orderBy: { grn: { createdAt: 'asc' } },
        });

        for (const batch of batches) {
          if (remaining <= 0) break;
          const deduct = Math.min(remaining, Number(batch.qtyRemaining));
          await tx.goodsReceivedNoteItem.update({
            where: { id: batch.id },
            data: { qtyRemaining: { decrement: deduct } },
          });
          movementData.push({
            tenantId,
            productId: item.productId,
            variantId: item.variantId ?? null,
            batchId: batch.id,
            unitCost: batch.unitCost,
            qtyDelta: -deduct,
            reason: 'SALE',
            refId: invoice.id,
            deviceId: dto.deviceId ?? null,
          });
          remaining -= deduct;
        }

        if (remaining > 0) {
          movementData.push({
            tenantId,
            productId: item.productId,
            variantId: item.variantId ?? null,
            qtyDelta: -remaining,
            reason: 'SALE',
            refId: invoice.id,
            deviceId: dto.deviceId ?? null,
          });
        }
      }

      if (movementData.length) {
        await tx.stockMovement.createMany({ data: movementData });
      }

      // ── Bust Redis stock cache for affected products ───────────────────
      const bust = dto.items.map((item) =>
        this.redis.del(`stock:${tenantId}:${item.productId}`),
      );
      await Promise.allSettled(bust); // don't fail the tx if Redis is down

      return tx.invoice.findUnique({
        where: { id: invoice.id },
        include: INVOICE_INCLUDE,
      });
    });

    // Fire-and-forget: a sale must never fail because messaging did. Runs
    // after the transaction commits so a slow/down provider can't hold up
    // the checkout response.
    this.autoSendReceipt(tenantId, invoice).catch((err) =>
      this.logger.warn(`Auto receipt send failed for invoice ${invoice?.id}: ${err.message}`),
    );

    return invoice;
  }

  private async autoSendReceipt(tenantId: string, invoice: any) {
    const phone = invoice?.customer?.phone;
    if (!phone) return;

    const settings = await this.notifications.getSettings(tenantId);
    const body = `Thank you for your purchase!\nReceipt ${invoice.number}\nTotal: LKR ${Number(invoice.total).toFixed(2)}`;

    if (settings.whatsappEnabled && settings.autoSendReceiptWhatsapp) {
      await this.notifications.send(tenantId, { channel: 'WHATSAPP', to: phone, body, relatedInvoiceId: invoice.id });
    }
    if (settings.smsEnabled && settings.autoSendReceiptSms) {
      await this.notifications.send(tenantId, { channel: 'SMS', to: phone, body, relatedInvoiceId: invoice.id });
    }
  }

  // ─── Queries ────────────────────────────────────────────────────────────

  async list(tenantId: string, page = 1, limit = 20) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.invoice.findMany({
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            customer: { select: { id: true, name: true } },
            outlet: { select: { id: true, name: true } },
            payments: { select: { method: true, amount: true } },
          },
        }),
        tx.invoice.count(),
      ]);
      return { items, total, page, limit };
    });
  }

  async getById(tenantId: string, id: string) {
    const invoice = await this.prisma.withTenant(tenantId, (tx) =>
      tx.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE }),
    );
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async getByNumber(tenantId: string, number: string) {
    const invoice = await this.prisma.withTenant(tenantId, (tx) =>
      tx.invoice.findFirst({ where: { number }, include: INVOICE_INCLUDE }),
    );
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }
}
