import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

const INVOICE_INCLUDE = {
  items: { include: { product: { select: { id: true, name: true } } } },
  payments: true,
  customer: { select: { id: true, name: true, phone: true } },
  outlet: { select: { id: true, name: true } },
} as const;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── Create (idempotent) ────────────────────────────────────────────────
  //
  // The client provides a UUID (generated on the device before going online).
  // If this UUID has already been stored, we return the existing invoice
  // without side-effects — safe to retry on network failure.

  async create(tenantId: string, dto: CreateInvoiceDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
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
      // Negative delta = stock out (sale).  Only for products that track stock.
      const movementData = dto.items
        .filter((item) => productMap.get(item.productId)?.trackStock)
        .map((item) => ({
          tenantId,
          productId: item.productId,
          variantId: item.variantId ?? null,
          qtyDelta: -Number(item.qty),
          reason: 'SALE' as const,
          refId: invoice.id,
          deviceId: dto.deviceId ?? null,
        }));

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
