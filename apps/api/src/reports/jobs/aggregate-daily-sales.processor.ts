import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

/**
 * Cost of goods sold for one invoice_item row (aliased `ii`, joined to its
 * invoice `i`). Prefers the actual batch cost the sale drew from — summed
 * from `stock_movements.unit_cost` for that specific invoice/product/variant
 * — since that's the true historical cost at the time of sale (batches can
 * cost different amounts over time; using "current" cost would silently
 * rewrite the profit on old sales whenever a new GRN changes it).
 *
 * Falls back to the product/variant's current cost snapshot only when no
 * costed batch movement exists for that line — e.g. `trackStock: false`
 * items (never generate a movement at all), legacy stock predating batch
 * tracking, or manually-typed "misc" lines with no matching product row
 * (COALESCE(...,0) then correctly treats those as zero COGS).
 *
 * Requires the query to also `LEFT JOIN product_variants pv ON pv.id = ii.variant_id`
 * alongside the existing `LEFT JOIN products p ON p.id = ii.product_id`.
 */
const COGS_EXPR = Prisma.sql`
  COALESCE(
    (SELECT SUM(-sm.qty_delta * sm.unit_cost)
     FROM stock_movements sm
     WHERE sm.tenant_id = ii.tenant_id
       AND sm.ref_id = i.id::text
       AND sm.product_id = ii.product_id
       AND sm.variant_id IS NOT DISTINCT FROM ii.variant_id
       AND sm.reason = 'SALE'
       AND sm.unit_cost IS NOT NULL),
    ii.qty * COALESCE(pv.cost, p.cost, 0)
  )
`;

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
        // Two invoice-level columns (`total`, `tax`) must be aggregated at
        // invoice granularity — joining straight through invoice_items and
        // summing them would double/triple-count any invoice with more than
        // one line. Profit is `invoice.total - invoice's total COGS`, which
        // correctly reflects a bill-level discount (baked into `i.total`)
        // instead of the pre-discount sum of line totals.
        await tx.$executeRaw`
          WITH invoice_cogs AS (
            SELECT ii.invoice_id, SUM(${COGS_EXPR}) AS cogs
            FROM invoice_items ii
            JOIN invoices i               ON i.id = ii.invoice_id
            LEFT JOIN products p          ON p.id = ii.product_id
            LEFT JOIN product_variants pv ON pv.id = ii.variant_id
            WHERE i.status IN ('PAID', 'PARTIAL_REFUND', 'REFUNDED')
              AND DATE(i.created_at AT TIME ZONE 'UTC') = ${date}::date
            GROUP BY ii.invoice_id
          )
          INSERT INTO daily_sales_summaries
            (id, tenant_id, outlet_id, date, total_sales, total_tax, total_profit, items_sold, invoice_count, created_at, updated_at)
          SELECT
            gen_random_uuid()::text,
            i.tenant_id,
            i.outlet_id,
            DATE(i.created_at AT TIME ZONE 'UTC'),
            COALESCE(SUM(i.total), 0)::numeric(14,2),
            COALESCE(SUM(i.tax),   0)::numeric(14,2),
            COALESCE(SUM(i.total - COALESCE(ic.cogs, 0)), 0)::numeric(14,2),
            COALESCE(SUM(item_totals.qty), 0)::numeric(14,3),
            COUNT(DISTINCT i.id)::int,
            NOW(), NOW()
          FROM invoices i
          LEFT JOIN invoice_cogs ic ON ic.invoice_id = i.id
          LEFT JOIN (
            SELECT invoice_id, SUM(qty) AS qty FROM invoice_items GROUP BY invoice_id
          ) item_totals ON item_totals.invoice_id = i.id
          WHERE i.status IN ('PAID', 'PARTIAL_REFUND', 'REFUNDED')
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
            COALESCE(SUM(ii.line_total - (${COGS_EXPR})), 0)::numeric(14,2),
            NOW(), NOW()
          FROM invoice_items ii
          JOIN invoices i    ON i.id = ii.invoice_id
          LEFT JOIN products p          ON p.id = ii.product_id
          LEFT JOIN product_variants pv ON pv.id = ii.variant_id
          WHERE i.status IN ('PAID', 'PARTIAL_REFUND', 'REFUNDED')
            AND DATE(i.created_at AT TIME ZONE 'UTC') = ${date}::date
          GROUP BY ii.tenant_id, ii.product_id, DATE(i.created_at AT TIME ZONE 'UTC')
          ON CONFLICT (tenant_id, product_id, date) DO UPDATE SET
            qty_sold   = EXCLUDED.qty_sold,
            revenue    = EXCLUDED.revenue,
            profit     = EXCLUDED.profit,
            updated_at = NOW()
        `;

        // ── Variant sales summary (textile size/color breakdown) ───────────
        await tx.$executeRaw`
          INSERT INTO variant_sales_summaries
            (id, tenant_id, product_id, variant_id, date, qty_sold, revenue, profit, created_at, updated_at)
          SELECT
            gen_random_uuid()::text,
            ii.tenant_id,
            ii.product_id,
            ii.variant_id,
            DATE(i.created_at AT TIME ZONE 'UTC'),
            COALESCE(SUM(ii.qty),       0)::numeric(12,3),
            COALESCE(SUM(ii.line_total),0)::numeric(14,2),
            COALESCE(SUM(ii.line_total - (${COGS_EXPR})), 0)::numeric(14,2),
            NOW(), NOW()
          FROM invoice_items ii
          JOIN invoices i    ON i.id = ii.invoice_id
          LEFT JOIN products p          ON p.id = ii.product_id
          LEFT JOIN product_variants pv ON pv.id = ii.variant_id
          WHERE i.status IN ('PAID', 'PARTIAL_REFUND', 'REFUNDED')
            AND ii.variant_id IS NOT NULL
            AND DATE(i.created_at AT TIME ZONE 'UTC') = ${date}::date
          GROUP BY ii.tenant_id, ii.product_id, ii.variant_id, DATE(i.created_at AT TIME ZONE 'UTC')
          ON CONFLICT (tenant_id, variant_id, date) DO UPDATE SET
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
