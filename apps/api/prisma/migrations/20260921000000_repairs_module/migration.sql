-- ──────────────────────────────────────────────────────────────────────────────
-- Repair jobs module — extends the existing (bare) repair_jobs table with
-- everything needed to run it as a real workflow: outlet/technician
-- assignment, a link to the invoice generated when the job is billed, and a
-- new repair_job_parts line-item table for parts consumed. Stock for those
-- parts is deducted exactly once, at checkout, through the normal invoice
-- creation path (see RepairsService.checkout) — no new StockMovementReason
-- is introduced, so repair revenue/COGS show up in existing sales & profit
-- reports automatically.
-- ──────────────────────────────────────────────────────────────────────────────

-- ─── repair_jobs: new columns ────────────────────────────────────────────────

ALTER TABLE "repair_jobs"
  ADD COLUMN "outlet_id"     TEXT,
  ADD COLUMN "technician_id" TEXT,
  ADD COLUMN "invoice_id"    UUID,
  ADD COLUMN "diagnosis"     TEXT,
  ADD COLUMN "labor_charge"  DECIMAL(12,2) NOT NULL DEFAULT 0;

-- customer_id has existed as a bare, unconstrained text column since
-- 20240106000000_vertical_tables — clear any value that doesn't match a real
-- customer before adding the FK (dev/demo data only; no tenant has ever been
-- able to rely on this column resolving to anything).
UPDATE "repair_jobs" rj
  SET "customer_id" = NULL
  WHERE rj."customer_id" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "customers" c WHERE c."id" = rj."customer_id");

ALTER TABLE "repair_jobs"
  ADD CONSTRAINT "repair_jobs_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id");

ALTER TABLE "repair_jobs"
  ADD CONSTRAINT "repair_jobs_outlet_id_fkey"
  FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id");

ALTER TABLE "repair_jobs"
  ADD CONSTRAINT "repair_jobs_technician_id_fkey"
  FOREIGN KEY ("technician_id") REFERENCES "users"("id");

ALTER TABLE "repair_jobs"
  ADD CONSTRAINT "repair_jobs_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id");

CREATE UNIQUE INDEX "repair_jobs_invoice_id_key" ON "repair_jobs"("invoice_id");

CREATE INDEX "idx_repair_jobs_tenant_technician" ON "repair_jobs"("tenant_id", "technician_id");

-- ─── repair_job_parts: new table ─────────────────────────────────────────────

CREATE TABLE "repair_job_parts" (
    "id"            TEXT          NOT NULL,
    "tenant_id"     TEXT          NOT NULL,
    "repair_job_id" TEXT          NOT NULL,
    "product_id"    TEXT          NOT NULL,
    "variant_id"    TEXT,
    "qty"           DECIMAL(12,3) NOT NULL,
    "unit_cost"     DECIMAL(12,2),
    "unit_price"    DECIMAL(12,2) NOT NULL,
    "created_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "repair_job_parts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_repair_job_parts_tenant_job" ON "repair_job_parts"("tenant_id", "repair_job_id");

ALTER TABLE "repair_job_parts"
  ADD CONSTRAINT "repair_job_parts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "repair_job_parts"
  ADD CONSTRAINT "repair_job_parts_repair_job_id_fkey"
  FOREIGN KEY ("repair_job_id") REFERENCES "repair_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "repair_job_parts"
  ADD CONSTRAINT "repair_job_parts_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id");

ALTER TABLE "repair_job_parts"
  ADD CONSTRAINT "repair_job_parts_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id");

ALTER TABLE "repair_job_parts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "repair_job_parts" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "repair_job_parts"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
