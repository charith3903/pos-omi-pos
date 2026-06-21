-- Migration: report summary tables (daily_sales_summaries + product_sales_summaries)
-- These are written by the BullMQ nightly job and queried for fast dashboard KPIs.

CREATE TABLE IF NOT EXISTS "daily_sales_summaries" (
  "id"            TEXT         NOT NULL,
  "tenant_id"     TEXT         NOT NULL,
  "outlet_id"     TEXT         NOT NULL,
  "date"          DATE         NOT NULL,
  "total_sales"   NUMERIC(14,2) NOT NULL DEFAULT 0,
  "total_tax"     NUMERIC(14,2) NOT NULL DEFAULT 0,
  "total_profit"  NUMERIC(14,2) NOT NULL DEFAULT 0,
  "items_sold"    NUMERIC(14,3) NOT NULL DEFAULT 0,
  "invoice_count" INTEGER      NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT "daily_sales_summaries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "daily_sales_summaries_tenant_outlet_date_key"
    UNIQUE ("tenant_id", "outlet_id", "date"),
  CONSTRAINT "daily_sales_summaries_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_dss_tenant_date"
  ON "daily_sales_summaries" ("tenant_id", "date");

ALTER TABLE "daily_sales_summaries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_sales_summaries" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "daily_sales_summaries";
CREATE POLICY "tenant_isolation" ON "daily_sales_summaries"
  USING (tenant_id = current_setting('app.current_tenant', true));

-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "product_sales_summaries" (
  "id"         TEXT         NOT NULL,
  "tenant_id"  TEXT         NOT NULL,
  "product_id" TEXT         NOT NULL,
  "date"       DATE         NOT NULL,
  "qty_sold"   NUMERIC(12,3) NOT NULL DEFAULT 0,
  "revenue"    NUMERIC(14,2) NOT NULL DEFAULT 0,
  "profit"     NUMERIC(14,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT "product_sales_summaries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_sales_summaries_tenant_product_date_key"
    UNIQUE ("tenant_id", "product_id", "date"),
  CONSTRAINT "product_sales_summaries_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "product_sales_summaries_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_pss_tenant_date"
  ON "product_sales_summaries" ("tenant_id", "date");

CREATE INDEX IF NOT EXISTS "idx_pss_tenant_product"
  ON "product_sales_summaries" ("tenant_id", "product_id");

ALTER TABLE "product_sales_summaries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_sales_summaries" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "product_sales_summaries";
CREATE POLICY "tenant_isolation" ON "product_sales_summaries"
  USING (tenant_id = current_setting('app.current_tenant', true));

-- Supporting indexes on invoices table for aggregation queries
CREATE INDEX IF NOT EXISTS "idx_invoices_tenant_outlet_date"
  ON "invoices" ("tenant_id", "outlet_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_invoices_status_created"
  ON "invoices" ("status", "created_at");
