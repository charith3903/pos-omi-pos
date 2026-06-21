-- ─── POS Domain Migration ────────────────────────────────────────────────────
-- Adds: categories, products, product_variants, stock_movements,
--        customers, suppliers, invoices, invoice_items, payments,
--        invoice_counters.
-- All tenant-scoped tables get FORCE ROW LEVEL SECURITY matching the
-- pattern from the init migration.

-- ─── New Enums ───────────────────────────────────────────────────────────────

CREATE TYPE "StockMovementReason" AS ENUM (
  'SALE', 'PURCHASE', 'ADJUSTMENT', 'RETURN', 'DAMAGE', 'TRANSFER'
);

CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PAID', 'VOID', 'REFUNDED');
CREATE TYPE "SyncStatus"    AS ENUM ('SYNCED', 'PENDING', 'CONFLICT');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'CHEQUE', 'CREDIT');

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE "categories" (
    "id"         TEXT         NOT NULL,
    "tenant_id"  TEXT         NOT NULL,
    "name"       TEXT         NOT NULL,
    "parent_id"  TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
    "id"          TEXT         NOT NULL,
    "tenant_id"   TEXT         NOT NULL,
    "category_id" TEXT,
    "name"        TEXT         NOT NULL,
    "sku"         TEXT,
    "barcode"     TEXT,
    "price"       DECIMAL(12,2) NOT NULL,
    "cost"        DECIMAL(12,2),
    "tax_rate"    DECIMAL(5,4) NOT NULL DEFAULT 0,
    "track_stock" BOOLEAN      NOT NULL DEFAULT true,
    "attributes"  JSONB,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_variants" (
    "id"         TEXT          NOT NULL,
    "tenant_id"  TEXT          NOT NULL,
    "product_id" TEXT          NOT NULL,
    "attributes" JSONB         NOT NULL,
    "price"      DECIMAL(12,2),
    "barcode"    TEXT,
    "sku"        TEXT,
    "created_at" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3)  NOT NULL,
    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- Append-only ledger: INSERT only, never UPDATE or DELETE.
-- current_stock = SUM(qty_delta) per (product_id, variant_id).
CREATE TABLE "stock_movements" (
    "id"         TEXT                   NOT NULL,
    "tenant_id"  TEXT                   NOT NULL,
    "product_id" TEXT                   NOT NULL,
    "variant_id" TEXT,
    "qty_delta"  DECIMAL(12,3)          NOT NULL,
    "reason"     "StockMovementReason"  NOT NULL,
    "ref_id"     TEXT,
    "device_id"  TEXT,
    "created_at" TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customers" (
    "id"         TEXT         NOT NULL,
    "tenant_id"  TEXT         NOT NULL,
    "name"       TEXT         NOT NULL,
    "email"      TEXT,
    "phone"      TEXT,
    "address"    TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "suppliers" (
    "id"         TEXT         NOT NULL,
    "tenant_id"  TEXT         NOT NULL,
    "name"       TEXT         NOT NULL,
    "email"      TEXT,
    "phone"      TEXT,
    "address"    TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoices" (
    "id"          UUID             NOT NULL,  -- client-generated for offline idempotency
    "tenant_id"   TEXT             NOT NULL,
    "outlet_id"   TEXT             NOT NULL,
    "device_id"   TEXT,
    "number"      TEXT             NOT NULL,
    "customer_id" TEXT,
    "subtotal"    DECIMAL(12,2)    NOT NULL,
    "discount"    DECIMAL(12,2)    NOT NULL DEFAULT 0,
    "tax"         DECIMAL(12,2)    NOT NULL DEFAULT 0,
    "total"       DECIMAL(12,2)    NOT NULL,
    "status"      "InvoiceStatus"  NOT NULL DEFAULT 'PAID',
    "sync_status" "SyncStatus"     NOT NULL DEFAULT 'SYNCED',
    "created_at"  TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3)     NOT NULL,
    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_items" (
    "id"            TEXT          NOT NULL,
    "tenant_id"     TEXT          NOT NULL,
    "invoice_id"    UUID          NOT NULL,
    "product_id"    TEXT          NOT NULL,
    "variant_id"    TEXT,
    "name_snapshot" TEXT          NOT NULL,
    "qty"           DECIMAL(12,3) NOT NULL,
    "unit_price"    DECIMAL(12,2) NOT NULL,
    "discount"      DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax"           DECIMAL(12,2) NOT NULL DEFAULT 0,
    "line_total"    DECIMAL(12,2) NOT NULL,
    "created_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
    "id"         TEXT             NOT NULL,
    "tenant_id"  TEXT             NOT NULL,
    "invoice_id" UUID             NOT NULL,
    "method"     "PaymentMethod"  NOT NULL,
    "amount"     DECIMAL(12,2)    NOT NULL,
    "reference"  TEXT,
    "created_at" TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- One row per tenant; locked FOR UPDATE during invoice creation to guarantee
-- sequential numbers with no gaps.
CREATE TABLE "invoice_counters" (
    "tenant_id" TEXT NOT NULL,
    "last_num"  INT  NOT NULL DEFAULT 0,
    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("tenant_id")
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- Core lookup indexes requested in the spec
CREATE INDEX "idx_products_tenant_barcode" ON "products"("tenant_id", "barcode");
CREATE INDEX "idx_products_tenant_sku"     ON "products"("tenant_id", "sku");
CREATE INDEX "idx_variants_tenant_barcode" ON "product_variants"("tenant_id", "barcode");

-- Uniqueness
CREATE UNIQUE INDEX "products_tenant_id_sku_key" ON "products"("tenant_id", "sku")
    WHERE sku IS NOT NULL;

-- High-frequency query paths
CREATE INDEX "idx_stock_tenant_product"  ON "stock_movements"("tenant_id", "product_id");
CREATE INDEX "idx_invoices_tenant_created" ON "invoices"("tenant_id", "created_at" DESC);

-- ─── Foreign Keys ─────────────────────────────────────────────────────────────

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "products"
  ADD CONSTRAINT "products_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "products"
  ADD CONSTRAINT "products_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id");

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id");

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "suppliers"
  ADD CONSTRAINT "suppliers_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_outlet_id_fkey"
  FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id");

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("id");

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id");

ALTER TABLE "invoice_items"
  ADD CONSTRAINT "invoice_items_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_items"
  ADD CONSTRAINT "invoice_items_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id");

ALTER TABLE "invoice_items"
  ADD CONSTRAINT "invoice_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id");

ALTER TABLE "invoice_items"
  ADD CONSTRAINT "invoice_items_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id");

ALTER TABLE "invoice_counters"
  ADD CONSTRAINT "invoice_counters_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Row-Level Security ───────────────────────────────────────────────────────
-- Same pattern as the init migration: FORCE + single PERMISSIVE policy.
-- app.current_tenant is set via SET LOCAL inside PrismaService.withTenant().

ALTER TABLE "categories"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppliers"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_items"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_counters" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "categories"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "products"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "product_variants" FORCE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements" FORCE ROW LEVEL SECURITY;
ALTER TABLE "customers"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "suppliers"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "invoices"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "invoice_items"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "payments"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "invoice_counters" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "categories"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "products"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "product_variants"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "stock_movements"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "customers"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "suppliers"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "invoices"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "invoice_items"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "payments"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "invoice_counters"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
