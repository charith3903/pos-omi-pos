import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AggregateDailySalesPayload } from './jobs/aggregate-daily-sales.processor';

const CACHE_TTL = 300; // 5 minutes

@Injectable()
export class ReportsService {
  private readonly log = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue('aggregate-daily-sales') private readonly aggQueue: Queue,
  ) {}

  // ── Nightly job scheduling ─────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduleNightlyAggregation() {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const date = yesterday.toISOString().split('T')[0];

    for (const { id } of tenants) {
      await this.aggQueue.add('aggregate', { tenantId: id, date } satisfies AggregateDailySalesPayload);
    }
    this.log.log(`Scheduled aggregation for ${tenants.length} tenants (date=${date})`);
  }

  /** Manually trigger (re)aggregation for a tenant + date. */
  async triggerRefresh(tenantId: string, date?: string) {
    const d = date ?? new Date().toISOString().split('T')[0];
    const job = await this.aggQueue.add(
      'aggregate',
      { tenantId, date: d } satisfies AggregateDailySalesPayload,
      { priority: 1 },
    );
    return { jobId: job.id, tenantId, date: d };
  }

  // ── Generic cache helper ───────────────────────────────────────────────────

  private async cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached) as T;
    const result = await fn();
    await this.redis.set(key, JSON.stringify(result), 'EX', CACHE_TTL);
    return result;
  }

  // ── Sales summary ──────────────────────────────────────────────────────────

  async getSalesSummary(
    tenantId: string,
    from: string,
    to: string,
    outletId?: string,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ) {
    const key = `rpt:${tenantId}:sales:${from}:${to}:${outletId ?? 'all'}:${groupBy}`;
    return this.cached(key, async () => {
      const rows = await this.prisma.withTenant(tenantId, (tx) =>
        tx.dailySalesSummary.findMany({
          where: {
            date: { gte: new Date(from), lte: new Date(to) },
            ...(outletId && { outletId }),
          },
          orderBy: { date: 'asc' },
        }),
      );

      // Group by week or month if requested
      if (groupBy === 'day') return rows;

      const grouped: Record<string, {
        period: string; totalSales: number; totalTax: number;
        totalProfit: number; itemsSold: number; invoiceCount: number;
      }> = {};

      for (const r of rows) {
        const d = new Date(r.date);
        const period = groupBy === 'week'
          ? `${d.getFullYear()}-W${getISOWeek(d)}`
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        if (!grouped[period]) {
          grouped[period] = { period, totalSales: 0, totalTax: 0, totalProfit: 0, itemsSold: 0, invoiceCount: 0 };
        }
        grouped[period].totalSales   += Number(r.totalSales);
        grouped[period].totalTax     += Number(r.totalTax);
        grouped[period].totalProfit  += Number(r.totalProfit);
        grouped[period].itemsSold    += Number(r.itemsSold);
        grouped[period].invoiceCount += r.invoiceCount;
      }

      return Object.values(grouped);
    });
  }

  /** Cashier (device) breakdown — queried live with Redis cache. */
  async getCashierBreakdown(tenantId: string, from: string, to: string, outletId?: string) {
    const key = `rpt:${tenantId}:cashier:${from}:${to}:${outletId ?? 'all'}`;
    return this.cached(key, () =>
      this.prisma.withTenant(tenantId, async (tx) => {
        const rows = outletId
          ? await tx.$queryRaw<{ deviceId: string | null; deviceName: string | null; totalSales: string; invoiceCount: string }[]>`
              SELECT i.device_id AS "deviceId", d.name AS "deviceName",
                SUM(i.total)::text AS "totalSales", COUNT(i.id)::text AS "invoiceCount"
              FROM invoices i LEFT JOIN devices d ON d.id = i.device_id
              WHERE i.status = 'PAID'
                AND i.created_at >= ${new Date(from)} AND i.created_at <= ${new Date(to)}
                AND i.outlet_id = ${outletId}
              GROUP BY i.device_id, d.name ORDER BY SUM(i.total) DESC`
          : await tx.$queryRaw<{ deviceId: string | null; deviceName: string | null; totalSales: string; invoiceCount: string }[]>`
              SELECT i.device_id AS "deviceId", d.name AS "deviceName",
                SUM(i.total)::text AS "totalSales", COUNT(i.id)::text AS "invoiceCount"
              FROM invoices i LEFT JOIN devices d ON d.id = i.device_id
              WHERE i.status = 'PAID'
                AND i.created_at >= ${new Date(from)} AND i.created_at <= ${new Date(to)}
              GROUP BY i.device_id, d.name ORDER BY SUM(i.total) DESC`;
        return rows.map((r) => ({
          deviceId: r.deviceId,
          deviceName: r.deviceName ?? 'Unknown device',
          totalSales: Number(r.totalSales ?? 0),
          invoiceCount: Number(r.invoiceCount ?? 0),
        }));
      }),
    );
  }

  /** Today's KPI snapshot — used by the dashboard home. */
  async getTodayKpi(tenantId: string, outletId?: string) {
    const today = new Date().toISOString().split('T')[0];
    const key = `rpt:${tenantId}:kpi:today:${outletId ?? 'all'}`;
    return this.cached(key, async () => {
      const rows = await this.prisma.withTenant(tenantId, (tx) =>
        tx.dailySalesSummary.findMany({
          where: {
            date: new Date(today),
            ...(outletId && { outletId }),
          },
        }),
      );
      return {
        totalSales:   rows.reduce((s, r) => s + Number(r.totalSales), 0),
        totalTax:     rows.reduce((s, r) => s + Number(r.totalTax), 0),
        totalProfit:  rows.reduce((s, r) => s + Number(r.totalProfit), 0),
        itemsSold:    rows.reduce((s, r) => s + Number(r.itemsSold), 0),
        invoiceCount: rows.reduce((s, r) => s + r.invoiceCount, 0),
      };
    });
  }

  // ── Product reports ────────────────────────────────────────────────────────

  async getTopProducts(
    tenantId: string,
    from: string,
    to: string,
    metric: 'revenue' | 'qty' | 'profit' = 'revenue',
    limit = 10,
  ) {
    const key = `rpt:${tenantId}:products:top:${from}:${to}:${metric}:${limit}`;
    return this.cached(key, async () => {
      const rows = await this.prisma.withTenant(tenantId, async (tx) => {
        const data = await tx.productSalesSummary.groupBy({
          by: ['productId'],
          where: { date: { gte: new Date(from), lte: new Date(to) } },
          _sum: { qtySold: true, revenue: true, profit: true },
          orderBy: { _sum: { [metric === 'qty' ? 'qtySold' : metric]: 'desc' } },
          take: limit,
        });

        // Fetch product names
        const productIds = data.map((d) => d.productId);
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, sku: true },
        });
        const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

        return data.map((d) => ({
          productId: d.productId,
          productName: productMap[d.productId]?.name ?? 'Unknown',
          sku: productMap[d.productId]?.sku ?? '',
          qtySold: Number(d._sum.qtySold ?? 0),
          revenue: Number(d._sum.revenue ?? 0),
          profit: Number(d._sum.profit ?? 0),
        }));
      });
      return rows;
    });
  }

  async getSlowMovers(tenantId: string, days = 30, limit = 20) {
    const key = `rpt:${tenantId}:products:slow:${days}:${limit}`;
    return this.cached(key, () =>
      this.prisma.withTenant(tenantId, async (tx) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        // Products that sold in the period — to exclude them
        const activePids = (await tx.productSalesSummary.findMany({
          where: { date: { gte: cutoff } },
          select: { productId: true },
          distinct: ['productId'],
        })).map((r) => r.productId);

        // Products with stock but no recent sales
        const slow = await tx.$queryRaw<
          { productId: string; productName: string; sku: string | null; currentStock: string }[]
        >`
          SELECT
            p.id        AS "productId",
            p.name      AS "productName",
            p.sku       AS "sku",
            COALESCE(SUM(sm.qty_delta), 0)::text AS "currentStock"
          FROM products p
          LEFT JOIN stock_movements sm ON sm.product_id = p.id
          WHERE p.track_stock = true
            AND p.id != ALL(${activePids})
          GROUP BY p.id, p.name, p.sku
          HAVING COALESCE(SUM(sm.qty_delta), 0) > 0
          ORDER BY COALESCE(SUM(sm.qty_delta), 0) DESC
          LIMIT ${limit}
        `;

        return slow.map((r) => ({
          ...r,
          currentStock: Number(r.currentStock),
        }));
      }),
    );
  }

  // ── Stock reports ──────────────────────────────────────────────────────────

  async getStockValue(tenantId: string) {
    const key = `rpt:${tenantId}:stock:value`;
    return this.cached(key, () =>
      this.prisma.withTenant(tenantId, async (tx) => {
        const rows = await tx.$queryRaw<
          { categoryName: string | null; totalQty: string; totalValue: string; productCount: string }[]
        >`
          SELECT
            c.name                       AS "categoryName",
            SUM(stock.qty)::text         AS "totalQty",
            SUM(stock.qty * COALESCE(p.cost, p.price))::text AS "totalValue",
            COUNT(DISTINCT p.id)::text   AS "productCount"
          FROM products p
          LEFT JOIN categories c ON c.id = p.category_id
          JOIN LATERAL (
            SELECT COALESCE(SUM(sm.qty_delta), 0) AS qty
            FROM stock_movements sm
            WHERE sm.product_id = p.id
          ) stock ON true
          WHERE p.track_stock = true
          GROUP BY c.name
          ORDER BY SUM(stock.qty * COALESCE(p.cost, p.price)) DESC
        `;

        const totalValue = rows.reduce((s, r) => s + Number(r.totalValue ?? 0), 0);
        const totalQty   = rows.reduce((s, r) => s + Number(r.totalQty ?? 0), 0);

        return {
          totalValue,
          totalQty,
          byCategory: rows.map((r) => ({
            categoryName: r.categoryName ?? 'Uncategorised',
            totalQty:     Number(r.totalQty),
            totalValue:   Number(r.totalValue),
            productCount: Number(r.productCount),
          })),
        };
      }),
    );
  }

  async getStockAlerts(tenantId: string) {
    const key = `rpt:${tenantId}:stock:alerts`;
    return this.cached(key, () =>
      this.prisma.withTenant(tenantId, async (tx) => {
        // Low stock: current stock <= threshold (from attributes.min_stock_alert or 5)
        const lowStock = await tx.$queryRaw<
          { productId: string; productName: string; sku: string | null; currentStock: string; threshold: string }[]
        >`
          SELECT
            p.id   AS "productId",
            p.name AS "productName",
            p.sku  AS "sku",
            COALESCE(SUM(sm.qty_delta), 0)::text AS "currentStock",
            COALESCE((p.attributes->>'min_stock_alert')::numeric, 5)::text AS "threshold"
          FROM products p
          LEFT JOIN stock_movements sm ON sm.product_id = p.id
          WHERE p.track_stock = true
          GROUP BY p.id, p.name, p.sku, p.attributes
          HAVING COALESCE(SUM(sm.qty_delta), 0)
            <= COALESCE((p.attributes->>'min_stock_alert')::numeric, 5)
            AND COALESCE(SUM(sm.qty_delta), 0) >= 0
          ORDER BY COALESCE(SUM(sm.qty_delta), 0) ASC
          LIMIT 50
        `;

        // Dead stock: stock > 0, no sales in 60 days
        const deadCutoff = new Date();
        deadCutoff.setDate(deadCutoff.getDate() - 60);
        const recentSellers = (await tx.productSalesSummary.findMany({
          where: { date: { gte: deadCutoff } },
          select: { productId: true },
          distinct: ['productId'],
        })).map((r) => r.productId);

        const deadStock = await tx.$queryRaw<
          { productId: string; productName: string; sku: string | null; currentStock: string }[]
        >`
          SELECT
            p.id   AS "productId",
            p.name AS "productName",
            p.sku  AS "sku",
            COALESCE(SUM(sm.qty_delta), 0)::text AS "currentStock"
          FROM products p
          LEFT JOIN stock_movements sm ON sm.product_id = p.id
          WHERE p.track_stock = true
            AND p.id != ALL(${recentSellers})
          GROUP BY p.id, p.name, p.sku
          HAVING COALESCE(SUM(sm.qty_delta), 0) > 0
          ORDER BY COALESCE(SUM(sm.qty_delta), 0) DESC
          LIMIT 50
        `;

        return {
          lowStock: lowStock.map((r) => ({
            ...r,
            currentStock: Number(r.currentStock),
            threshold: Number(r.threshold),
          })),
          deadStock: deadStock.map((r) => ({
            ...r,
            currentStock: Number(r.currentStock),
          })),
        };
      }),
    );
  }

  // ── Customer report ────────────────────────────────────────────────────────

  async getTopCustomers(tenantId: string, from: string, to: string, limit = 10) {
    const key = `rpt:${tenantId}:customers:top:${from}:${to}:${limit}`;
    return this.cached(key, () =>
      this.prisma.withTenant(tenantId, async (tx) => {
        const rows = await tx.$queryRaw<
          {
            customerId: string; customerName: string; phone: string | null;
            totalSpent: string; invoiceCount: string; lastPurchase: Date;
          }[]
        >`
          SELECT
            c.id           AS "customerId",
            c.name         AS "customerName",
            c.phone        AS "phone",
            SUM(i.total)::text    AS "totalSpent",
            COUNT(i.id)::text     AS "invoiceCount",
            MAX(i.created_at)     AS "lastPurchase"
          FROM customers c
          JOIN invoices i ON i.customer_id = c.id
          WHERE i.status = 'PAID'
            AND i.created_at >= ${new Date(from)}
            AND i.created_at <= ${new Date(to)}
          GROUP BY c.id, c.name, c.phone
          ORDER BY SUM(i.total) DESC
          LIMIT ${limit}
        `;
        return rows.map((r) => ({
          ...r,
          totalSpent: Number(r.totalSpent ?? 0),
          invoiceCount: Number(r.invoiceCount ?? 0),
        }));
      }),
    );
  }

  // ── CSV export ─────────────────────────────────────────────────────────────

  async exportCsv(
    tenantId: string,
    type: 'sales' | 'products' | 'stock' | 'customers',
    from: string,
    to: string,
    outletId?: string,
  ): Promise<{ filename: string; csv: string }> {
    switch (type) {
      case 'sales': {
        const rows = await this.getSalesSummary(tenantId, from, to, outletId, 'day') as any[];
        const csv = toCsv(
          ['Date', 'Total Sales', 'Total Tax', 'Total Profit', 'Items Sold', 'Invoices'],
          rows.map((r) => [r.date ?? r.period, r.totalSales, r.totalTax, r.totalProfit, r.itemsSold, r.invoiceCount]),
        );
        return { filename: `sales_${from}_${to}.csv`, csv };
      }
      case 'products': {
        const rows = await this.getTopProducts(tenantId, from, to, 'revenue', 50) as any[];
        const csv = toCsv(
          ['Product', 'SKU', 'Qty Sold', 'Revenue', 'Profit'],
          rows.map((r) => [r.productName, r.sku, r.qtySold, r.revenue, r.profit]),
        );
        return { filename: `products_${from}_${to}.csv`, csv };
      }
      case 'stock': {
        const { byCategory } = await this.getStockValue(tenantId) as any;
        const csv = toCsv(
          ['Category', 'Products', 'Total Qty', 'Total Value'],
          byCategory.map((r: any) => [r.categoryName, r.productCount, r.totalQty, r.totalValue]),
        );
        return { filename: `stock_${new Date().toISOString().split('T')[0]}.csv`, csv };
      }
      case 'customers': {
        const rows = await this.getTopCustomers(tenantId, from, to, 50) as any[];
        const csv = toCsv(
          ['Customer', 'Phone', 'Total Spent', 'Invoices', 'Last Purchase'],
          rows.map((r: any) => [r.customerName, r.phone, r.totalSpent, r.invoiceCount, r.lastPurchase]),
        );
        return { filename: `customers_${from}_${to}.csv`, csv };
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toCsv(headers: string[], rows: unknown[][]): string {
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.join(','), ...rows.map((r) => r.map(escape).join(','))];
  return lines.join('\r\n');
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
