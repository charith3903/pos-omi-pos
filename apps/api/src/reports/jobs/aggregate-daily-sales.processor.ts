import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

export interface AggregateDailySalesPayload {
  tenantId: string;
  date: string; // YYYY-MM-DD
}

@Processor('aggregate-daily-sales')
export class AggregateDailySalesProcessor extends WorkerHost {
  private readonly log = new Logger(AggregateDailySalesProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async process(job: Job<AggregateDailySalesPayload>): Promise<void> {
    const { tenantId, date } = job.data;
    this.log.log(`Aggregating daily sales — tenant=${tenantId} date=${date}`);

    try {
      await this.prisma.withTenant(tenantId, async (tx) => {
        // ── Daily sales summary by outlet ─────────────────────────────────
        await tx.$executeRaw`
          INSERT INTO daily_sales_summaries
            (id, tenant_id, outlet_id, date, total_sales, total_tax, total_profit, items_sold, invoice_count, created_at, updated_at)
          SELECT
            gen_random_uuid()::text,
            i.tenant_id,
            i.outlet_id,
            DATE(i.created_at AT TIME ZONE 'UTC'),
            COALESCE(SUM(i.total),    0)::numeric(14,2),
            COALESCE(SUM(i.tax),      0)::numeric(14,2),
            COALESCE(SUM(ii.line_total - ii.qty * COALESCE(p.cost, 0)), 0)::numeric(14,2),
            COALESCE(SUM(ii.qty),     0)::numeric(14,3),
            COUNT(DISTINCT i.id)::int,
            NOW(), NOW()
          FROM invoices i
          JOIN invoice_items ii ON ii.invoice_id = i.id
          LEFT JOIN products p  ON p.id = ii.product_id
          WHERE i.status = 'PAID'
            AND DATE(i.created_at AT TIME ZONE 'UTC') = ${date}::date
          GROUP BY i.tenant_id, i.outlet_id, DATE(i.created_at AT TIME ZONE 'UTC')
          ON CONFLICT (tenant_id, outlet_id, date) DO UPDATE SET
            total_sales   = EXCLUDED.total_sales,
            total_tax     = EXCLUDED.total_tax,
            total_profit  = EXCLUDED.total_profit,
            items_sold    = EXCLUDED.items_sold,
            invoice_count = EXCLUDED.invoice_count,
            updated_at    = NOW()
        `;

        // ── Product sales summary ─────────────────────────────────────────
        await tx.$executeRaw`
          INSERT INTO product_sales_summaries
            (id, tenant_id, product_id, date, qty_sold, revenue, profit, created_at, updated_at)
          SELECT
            gen_random_uuid()::text,
            ii.tenant_id,
            ii.product_id,
            DATE(i.created_at AT TIME ZONE 'UTC'),
            COALESCE(SUM(ii.qty),       0)::numeric(12,3),
            COALESCE(SUM(ii.line_total),0)::numeric(14,2),
            COALESCE(SUM(ii.line_total - ii.qty * COALESCE(p.cost, 0)), 0)::numeric(14,2),
            NOW(), NOW()
          FROM invoice_items ii
          JOIN invoices i    ON i.id = ii.invoice_id
          LEFT JOIN products p ON p.id = ii.product_id
          WHERE i.status = 'PAID'
            AND DATE(i.created_at AT TIME ZONE 'UTC') = ${date}::date
          GROUP BY ii.tenant_id, ii.product_id, DATE(i.created_at AT TIME ZONE 'UTC')
          ON CONFLICT (tenant_id, product_id, date) DO UPDATE SET
            qty_sold   = EXCLUDED.qty_sold,
            revenue    = EXCLUDED.revenue,
            profit     = EXCLUDED.profit,
            updated_at = NOW()
        `;
      });

      // Invalidate all Redis report caches for this tenant
      const keys = await this.redis.keys(`rpt:${tenantId}:*`);
      if (keys.length > 0) await this.redis.del(...keys);

      this.log.log(`Aggregation complete — tenant=${tenantId} date=${date}`);
    } catch (err) {
      this.log.error(`Aggregation failed — tenant=${tenantId} date=${date}: ${err}`);
      throw err; // Let BullMQ retry
    }
  }
}
