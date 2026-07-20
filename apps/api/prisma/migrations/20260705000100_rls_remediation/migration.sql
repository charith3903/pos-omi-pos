-- ──────────────────────────────────────────────────────────────────────────────
-- RLS remediation — idempotent, safe to run on any environment.
--
-- Live-DB verification while building the purchasing/warranty migration found
-- this project's actual databases can drift from the RLS state their
-- migration files imply (e.g. a `prisma db push` re-applied on top of an
-- existing `_prisma_migrations` history recreates tables/enums without ever
-- touching row security, since RLS isn't part of the Prisma schema language).
-- Verified directly against this repo's dev database: EVERY tenant-scoped
-- table — including ones whose migration files correctly contain ENABLE +
-- FORCE + POLICY — currently has RLS fully off.
--
-- This migration re-asserts ENABLE + FORCE + a single tenant_isolation policy
-- for every tenant-scoped table, using DROP POLICY IF EXISTS before each
-- CREATE POLICY so it is idempotent: on an environment where RLS was already
-- correct, this is a harmless no-op re-assertion; on a drifted environment
-- (like this one), it actually fixes tenant isolation.
--
-- Deliberately excluded (by design, not oversight):
--   tenants   — resolved pre-RLS to establish tenant context (see PrismaService)
--   sync_logs — "No RLS — inserted by service role" (schema.prisma comment)
-- ──────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'users', 'outlets', 'devices',
    'categories', 'products', 'product_variants', 'stock_movements',
    'customers', 'suppliers',
    'invoices', 'invoice_items', 'payments', 'invoice_counters',
    'daily_sales_summaries', 'product_sales_summaries',
    'restaurant_tables', 'kots', 'imei_records', 'repair_jobs',
    'rental_agreements', 'promotions',
    'restaurant_orders', 'split_bills', 'loyalty_accounts',
    'loyalty_transactions', 'shifts',
    'purchase_orders', 'purchase_order_items',
    'goods_received_notes', 'goods_received_note_items',
    'warranty_claims'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I AS PERMISSIVE FOR ALL ' ||
      'USING (tenant_id = current_setting(''app.current_tenant'', true)) ' ||
      'WITH CHECK (tenant_id = current_setting(''app.current_tenant'', true))',
      t
    );
  END LOOP;
END
$$;
