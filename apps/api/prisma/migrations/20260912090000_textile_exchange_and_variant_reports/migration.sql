-- Distinguishes a size/color exchange's stock movements from ordinary
-- returns/adjustments in the ledger and reporting.
ALTER TYPE "StockMovementReason" ADD VALUE 'EXCHANGE';

-- Supports the sync-pull "variants updated since X for this product" query
-- and the POS variant picker's per-product lookup.
CREATE INDEX IF NOT EXISTS "product_variants_tenant_id_product_id_idx"
  ON "product_variants" ("tenant_id", "product_id");

-- Variant-level breakdown of product_sales_summaries, populated by the same
-- nightly aggregation job, for verticals (textile) that sell one product as
-- multiple size/color variants.
CREATE TABLE IF NOT EXISTS "variant_sales_summaries" (
  "id"         TEXT         NOT NULL,
  "tenant_id"  TEXT         NOT NULL,
  "product_id" TEXT         NOT NULL,
  "variant_id" TEXT         NOT NULL,
  "date"       DATE         NOT NULL,
  "qty_sold"   NUMERIC(12,3) NOT NULL DEFAULT 0,
  "revenue"    NUMERIC(14,2) NOT NULL DEFAULT 0,
  "profit"     NUMERIC(14,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT "variant_sales_summaries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "variant_sales_summaries_tenant_variant_date_key"
    UNIQUE ("tenant_id", "variant_id", "date"),
  CONSTRAINT "variant_sales_summaries_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "variant_sales_summaries_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE,
  CONSTRAINT "variant_sales_summaries_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_vss_tenant_product_date"
  ON "variant_sales_summaries" ("tenant_id", "product_id", "date");

ALTER TABLE "variant_sales_summaries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "variant_sales_summaries" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "variant_sales_summaries";
CREATE POLICY "tenant_isolation" ON "variant_sales_summaries"
  USING (tenant_id = current_setting('app.current_tenant', true));
