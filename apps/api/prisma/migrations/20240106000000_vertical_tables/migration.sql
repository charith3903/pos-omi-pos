-- ──────────────────────────────────────────────────────────────────────────────
-- Vertical-specific tables: Restaurant, Mobile, Rental, Supermarket
-- All tables are tenant-scoped and RLS-protected.
-- ──────────────────────────────────────────────────────────────────────────────

-- Restaurant ──────────────────────────────────────────────────────────────────

CREATE TABLE "restaurant_tables" (
  "id"         TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"  TEXT        NOT NULL,
  "name"       TEXT        NOT NULL,
  "area"       TEXT,
  "capacity"   INTEGER     NOT NULL DEFAULT 4,
  "status"     TEXT        NOT NULL DEFAULT 'AVAILABLE',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kots" (
  "id"         TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"  TEXT        NOT NULL,
  "table_id"   TEXT,
  "invoice_id" UUID,
  "order_type" TEXT        NOT NULL DEFAULT 'DINE_IN',
  "items"      JSONB       NOT NULL DEFAULT '[]',
  "status"     TEXT        NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "kots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kots_table_id_fkey"
    FOREIGN KEY ("table_id") REFERENCES "restaurant_tables"("id")
);

-- Mobile ──────────────────────────────────────────────────────────────────────

CREATE TABLE "imei_records" (
  "id"              TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"       TEXT        NOT NULL,
  "invoice_id"      UUID,
  "product_id"      TEXT        NOT NULL,
  "imei"            TEXT        NOT NULL,
  "serial"          TEXT,
  "warranty_months" INTEGER     NOT NULL DEFAULT 12,
  "warranty_expires" TIMESTAMPTZ,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "imei_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "repair_jobs" (
  "id"               TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"        TEXT        NOT NULL,
  "customer_id"      TEXT,
  "device_make"      TEXT        NOT NULL,
  "device_model"     TEXT        NOT NULL,
  "imei"             TEXT,
  "issue"            TEXT        NOT NULL,
  "status"           TEXT        NOT NULL DEFAULT 'RECEIVED',
  "technician_notes" TEXT,
  "estimated_cost"   DECIMAL(12,2),
  "actual_cost"      DECIMAL(12,2),
  "received_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at"     TIMESTAMPTZ,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "repair_jobs_pkey" PRIMARY KEY ("id")
);

-- Rental ──────────────────────────────────────────────────────────────────────

CREATE TABLE "rental_agreements" (
  "id"             TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"      TEXT        NOT NULL,
  "invoice_id"     UUID,
  "customer_id"    TEXT,
  "product_id"     TEXT        NOT NULL,
  "rate"           DECIMAL(12,2) NOT NULL,
  "rate_unit"      TEXT        NOT NULL,
  "deposit"        DECIMAL(12,2) NOT NULL DEFAULT 0,
  "out_at"         TIMESTAMPTZ NOT NULL,
  "expected_in_at" TIMESTAMPTZ NOT NULL,
  "actual_in_at"   TIMESTAMPTZ,
  "status"         TEXT        NOT NULL DEFAULT 'ACTIVE',
  "late_fee"       DECIMAL(12,2) NOT NULL DEFAULT 0,
  "notes"          TEXT,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "rental_agreements_pkey" PRIMARY KEY ("id")
);

-- Supermarket ─────────────────────────────────────────────────────────────────

CREATE TABLE "promotions" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"   TEXT        NOT NULL,
  "name"        TEXT        NOT NULL,
  "type"        TEXT        NOT NULL,
  "conditions"  JSONB       NOT NULL DEFAULT '{}',
  "reward"      JSONB       NOT NULL DEFAULT '{}',
  "valid_from"  TIMESTAMPTZ NOT NULL,
  "valid_until" TIMESTAMPTZ,
  "is_active"   BOOLEAN     NOT NULL DEFAULT true,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- Indexes ─────────────────────────────────────────────────────────────────────

CREATE INDEX "idx_restaurant_tables_tenant"    ON "restaurant_tables"("tenant_id");
CREATE INDEX "idx_kots_tenant_status"          ON "kots"("tenant_id", "status");
CREATE INDEX "idx_imei_records_tenant_imei"    ON "imei_records"("tenant_id", "imei");
CREATE INDEX "idx_repair_jobs_tenant_status"   ON "repair_jobs"("tenant_id", "status");
CREATE INDEX "idx_rental_tenant_status"        ON "rental_agreements"("tenant_id", "status");
CREATE INDEX "idx_rental_tenant_product"       ON "rental_agreements"("tenant_id", "product_id");
CREATE INDEX "idx_promotions_tenant_active"    ON "promotions"("tenant_id", "is_active");

-- RLS ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "restaurant_tables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kots"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "imei_records"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "repair_jobs"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rental_agreements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "promotions"        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "restaurant_tables"
  USING (tenant_id = current_setting('app.current_tenant', true));
CREATE POLICY "tenant_isolation" ON "kots"
  USING (tenant_id = current_setting('app.current_tenant', true));
CREATE POLICY "tenant_isolation" ON "imei_records"
  USING (tenant_id = current_setting('app.current_tenant', true));
CREATE POLICY "tenant_isolation" ON "repair_jobs"
  USING (tenant_id = current_setting('app.current_tenant', true));
CREATE POLICY "tenant_isolation" ON "rental_agreements"
  USING (tenant_id = current_setting('app.current_tenant', true));
CREATE POLICY "tenant_isolation" ON "promotions"
  USING (tenant_id = current_setting('app.current_tenant', true));
