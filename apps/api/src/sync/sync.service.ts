import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SyncPushDto } from './dto/sync.dto';

@Injectable()
export class SyncService {
  private readonly log = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ── Push ─────────────────────────────────────────────────────────────────

  async push(
    tenantId: string,
    deviceId: string,
    dto: SyncPushDto,
  ): Promise<{ synced: number; skipped: number }> {
    // Resolve fallback outlet once per push batch
    const defaultOutlet = await this.prisma.withTenant(tenantId, (tx) =>
      tx.outlet.findFirst({ where: { isDefault: true }, select: { id: true } }),
    );
    const fallbackOutletId = defaultOutlet?.id ?? '';
    let synced = 0;
    let skipped = 0;

    for (const item of dto.items) {
      if (item.type !== 'invoice') continue;
      const data = item.data;

      try {
        await this.prisma.withTenant(tenantId, async (tx) => {
          // Idempotency: return existing invoice silently
          const existing = await tx.invoice.findUnique({ where: { id: item.id } });
          if (existing) { skipped++; return; }

          const resolvedOutletId =
            data.outletId && data.outletId !== 'offline'
              ? data.outletId
              : fallbackOutletId;

          // Atomic counter
          const counterRows = await tx.$queryRaw<[{ last_num: number }]>`
            INSERT INTO invoice_counters (tenant_id, last_num)
            VALUES (current_setting('app.current_tenant', true), 1)
            ON CONFLICT (tenant_id)
            DO UPDATE SET last_num = invoice_counters.last_num + 1
            RETURNING last_num
          `;
          const seq = Number(counterRows[0].last_num);
          const year = new Date().getFullYear();
          const number = `INV-${year}-${String(seq).padStart(6, '0')}`;

          await tx.invoice.create({
            data: {
              id: item.id,
              tenantId,
              outletId: resolvedOutletId,
              number,
              customerId: data.customerId ?? null,
              subtotal: data.subtotal,
              discount: data.discount ?? 0,
              tax: data.tax ?? 0,
              total: data.total,
              status: 'PAID',
              syncStatus: 'SYNCED',
              createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
              items: {
                create: (data.items ?? []).map((line) => ({
                  tenantId,
                  productId: line.productId,
                  nameSnapshot: line.nameSnapshot,
                  qty: line.qty,
                  unitPrice: line.unitPrice,
                  discount: line.discount ?? 0,
                  tax: line.tax ?? 0,
                  lineTotal: line.lineTotal,
                })),
              },
              payments: {
                create: (data.payments ?? []).map((p) => ({
                  tenantId,
                  method: p.method as any,
                  amount: p.amount,
                })),
              },
            },
          });

          // Stock movements — flag negative stock but never reject
          for (const line of data.items ?? []) {
            const [stockRow] = await tx.$queryRaw<[{ stock: string }]>`
              SELECT COALESCE(SUM(qty_delta), 0)::text AS stock
              FROM stock_movements
              WHERE tenant_id = current_setting('app.current_tenant', true)
                AND product_id = ${line.productId}
            `;
            const currentStock = parseFloat(stockRow.stock);
            if (currentStock < line.qty) {
              this.log.warn(
                `Negative stock after sync: product ${line.productId} ` +
                  `current=${currentStock} deducting=${line.qty}`,
              );
            }

            await tx.stockMovement.create({
              data: {
                tenantId,
                productId: line.productId,
                qtyDelta: -line.qty,
                reason: 'SALE',
                refId: item.id,
              },
            });
          }

          // Bust Redis stock cache
          await Promise.allSettled(
            (data.items ?? []).map((l) =>
              Promise.all([
                this.redis.del(`stock:${tenantId}:${l.productId}`),
                this.redis.del(`stock:${tenantId}:all`),
              ]),
            ),
          );

          synced++;

          // ── Vertical post-processing (outside main tx to avoid FK issues) ──
          await this._processVerticalMetadata(tenantId, item.id, data);
        });
      } catch (err) {
        this.log.error(`Failed to sync invoice ${item.id}: ${err}`);
        // Don't rethrow — process remaining items
      }
    }

    // Record sync log (outside tenant context — no RLS on sync_logs)
    await this.prisma.$executeRaw`
      INSERT INTO sync_logs (tenant_id, device_id, direction, item_count)
      VALUES (${tenantId}, ${deviceId}, 'PUSH', ${synced + skipped})
    `;

    return { synced, skipped };
  }

  // ── Vertical metadata ─────────────────────────────────────────────────────

  private async _processVerticalMetadata(
    tenantId: string,
    invoiceId: string,
    data: import('./dto/sync.dto').SyncInvoiceDataDto,
  ) {
    try {
      // MOBILE: create ImeiRecord for each line that carries IMEI metadata
      for (const line of data.items ?? []) {
        const meta = line.metadata as Record<string, any> | undefined;
        if (!meta?.imei) continue;

        const warrantyMonths = Number(meta.warrantyMonths ?? 12);
        const warrantyExpires = new Date();
        warrantyExpires.setMonth(warrantyExpires.getMonth() + warrantyMonths);

        await this.prisma.withTenant(tenantId, (tx) =>
          tx.imeiRecord.create({
            data: {
              tenantId,
              invoiceId,
              productId: line.productId,
              imei: String(meta.imei),
              serial: meta.serial ? String(meta.serial) : null,
              warrantyMonths,
              warrantyExpires,
            },
          }),
        ).catch((e) => this.log.warn(`IMEI record creation skipped: ${e.message}`));
      }

      // RENTAL: create RentalAgreement if invoice metadata contains rental data
      const invoiceMeta = data.metadata as Record<string, any> | undefined;
      if (invoiceMeta?.rentalAgreement) {
        const ra = invoiceMeta.rentalAgreement as Record<string, any>;
        await this.prisma.withTenant(tenantId, (tx) =>
          tx.rentalAgreement.create({
            data: {
              tenantId,
              invoiceId,
              customerId: ra.customerId ?? data.customerId ?? null,
              productId: ra.productId,
              rate: Number(ra.rate),
              rateUnit: String(ra.rateUnit ?? 'DAY'),
              deposit: Number(ra.deposit ?? 0),
              outAt: new Date(ra.outAt),
              expectedInAt: new Date(ra.expectedInAt),
              status: 'ACTIVE',
            },
          }),
        ).catch((e) => this.log.warn(`RentalAgreement creation skipped: ${e.message}`));
      }

      // RESTAURANT: create KOT if invoice metadata contains KOT data
      if (invoiceMeta?.kot) {
        const kot = invoiceMeta.kot as Record<string, any>;
        await this.prisma.withTenant(tenantId, (tx) =>
          tx.kot.create({
            data: {
              tenantId,
              invoiceId,
              tableId: kot.tableId ?? null,
              orderType: String(kot.orderType ?? 'DINE_IN'),
              items: kot.items ?? data.items,
              status: 'SENT', // already billed — mark as sent
            },
          }),
        ).catch((e) => this.log.warn(`KOT creation skipped: ${e.message}`));
      }
    } catch (err) {
      this.log.warn(`Vertical metadata processing failed for invoice ${invoiceId}: ${err}`);
    }
  }

  // ── Pull ──────────────────────────────────────────────────────────────────

  async pull(
    tenantId: string,
    since: Date,
  ): Promise<{
    products: any[];
    categories: any[];
    customers: any[];
    cursor: string;
  }> {
    const [products, categories, customers] = await Promise.all([
      this.prisma.withTenant(tenantId, (tx) =>
        tx.product.findMany({
          where: { updatedAt: { gt: since } },
          select: {
            id: true,
            name: true,
            sku: true,
            barcode: true,
            price: true,
            taxRate: true,
            trackStock: true,
            categoryId: true,
            attributes: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'asc' },
          take: 500,
        }),
      ),
      this.prisma.withTenant(tenantId, (tx) =>
        tx.category.findMany({
          where: { updatedAt: { gt: since } },
          select: { id: true, name: true, parentId: true, updatedAt: true },
          orderBy: { updatedAt: 'asc' },
          take: 200,
        }),
      ),
      this.prisma.withTenant(tenantId, (tx) =>
        tx.customer.findMany({
          where: { updatedAt: { gt: since } },
          select: { id: true, name: true, phone: true, email: true, updatedAt: true },
          orderBy: { updatedAt: 'asc' },
          take: 500,
        }),
      ),
    ]);

    const cursor = new Date().toISOString();

    await this.prisma.$executeRaw`
      INSERT INTO sync_logs (tenant_id, device_id, direction, item_count, cursor)
      VALUES (${tenantId}, 'pull', 'PULL',
              ${products.length + categories.length + customers.length},
              ${cursor})
    `;

    return {
      products: products.map((p) => ({
        ...p,
        price: Number(p.price),
        taxRate: Number(p.taxRate),
        updatedAt: p.updatedAt.toISOString(),
      })),
      categories: categories.map((c) => ({
        ...c,
        updatedAt: c.updatedAt.toISOString(),
      })),
      customers: customers.map((c) => ({
        ...c,
        updatedAt: c.updatedAt.toISOString(),
      })),
      cursor,
    };
  }
}
