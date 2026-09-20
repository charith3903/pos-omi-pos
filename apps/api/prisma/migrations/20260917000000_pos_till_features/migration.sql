-- ──────────────────────────────────────────────────────────────────────────────
-- Traditional POS till features: bill note + salesman tag on invoices,
-- retail/wholesale price tiers, customer credit balance, quotations,
-- held ("parked") sales, and a cash-drawer/expense/paid-out ledger.
-- ──────────────────────────────────────────────────────────────────────────────

-- ─── New Enums ───────────────────────────────────────────────────────────────

CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'CONVERTED', 'EXPIRED');
CREATE TYPE "CashMovementType" AS ENUM ('DRAWER_OPEN', 'PAID_IN', 'PAID_OUT');

-- ─── customers: credit sales ───────────────────────────────────────────────────

ALTER TABLE "customers"
  ADD COLUMN "credit_limit"   DECIMAL(12,2),
  ADD COLUMN "credit_balance" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- ─── invoices: bill note + salesman tag ───────────────────────────────────────

ALTER TABLE "invoices"
  ADD COLUMN "notes"       TEXT,
  ADD COLUMN "salesman_id" TEXT;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_salesman_id_fkey"
  FOREIGN KEY ("salesman_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── products / product_variants: Rate Type (Retail/Wholesale) ────────────────

ALTER TABLE "products"         ADD COLUMN "wholesale_price" DECIMAL(12,2);
ALTER TABLE "product_variants" ADD COLUMN "wholesale_price" DECIMAL(12,2);

-- ─── New tables ────────────────────────────────────────────────────────────────

CREATE TABLE "quotations" (
    "id"          TEXT             NOT NULL,
    "tenant_id"   TEXT             NOT NULL,
    "outlet_id"   TEXT,
    "customer_id" TEXT,
    "number"      TEXT             NOT NULL,
    "status"      "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "valid_until" TIMESTAMP(3),
    "total"       DECIMAL(12,2)    NOT NULL DEFAULT 0,
    "notes"       TEXT,
    "created_at"  TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3)     NOT NULL,
    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quotation_items" (
    "id"           TEXT          NOT NULL,
    "tenant_id"    TEXT          NOT NULL,
    "quotation_id" TEXT          NOT NULL,
    "product_id"   TEXT          NOT NULL,
    "variant_id"   TEXT,
    "qty"          DECIMAL(12,3) NOT NULL,
    "unit_price"   DECIMAL(12,2) NOT NULL,
    "discount"     DECIMAL(12,2) NOT NULL DEFAULT 0,
    "line_total"   DECIMAL(12,2) NOT NULL,
    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "held_sales" (
    "id"            TEXT         NOT NULL,
    "tenant_id"     TEXT         NOT NULL,
    "outlet_id"     TEXT,
    "customer_id"   TEXT,
    "note"          TEXT,
    "cart_snapshot" JSONB        NOT NULL,
    "created_by"    TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "held_sales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cash_movements" (
    "id"         TEXT              NOT NULL,
    "tenant_id"  TEXT              NOT NULL,
    "outlet_id"  TEXT,
    "shift_id"   TEXT              NOT NULL,
    "type"       "CashMovementType" NOT NULL,
    "amount"     DECIMAL(12,2)     NOT NULL DEFAULT 0,
    "reason"     TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX "quotations_tenant_id_status_idx" ON "quotations"("tenant_id", "status");
CREATE INDEX "held_sales_tenant_id_created_at_idx" ON "held_sales"("tenant_id", "created_at");
CREATE INDEX "cash_movements_tenant_id_shift_id_idx" ON "cash_movements"("tenant_id", "shift_id");

-- ─── Foreign Keys ─────────────────────────────────────────────────────────────

ALTER TABLE "quotations" ADD CONSTRAINT "quotations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey"
  FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "held_sales" ADD CONSTRAINT "held_sales_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "held_sales" ADD CONSTRAINT "held_sales_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_shift_id_fkey"
  FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Row-Level Security (new tables) ────────────────────────────────────────────

ALTER TABLE "quotations"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quotation_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "held_sales"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cash_movements"  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "quotations"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "quotation_items" FORCE ROW LEVEL SECURITY;
ALTER TABLE "held_sales"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "cash_movements"  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "quotations"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY "tenant_isolation" ON "quotation_items"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY "tenant_isolation" ON "held_sales"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY "tenant_isolation" ON "cash_movements"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
