-- ──────────────────────────────────────────────────────────────────────────────
-- Purchasing & Warranty tables
-- These models have existed in schema.prisma (commented "RLS enabled") since the
-- "Add restaurant, loyalty, purchasing & refunds" commit, but no migration ever
-- created them — any environment built via `prisma migrate deploy` (the
-- documented workflow) throws "relation does not exist" on first use of the
-- purchasing/warranty modules. This migration creates the 5 missing tables.
-- ──────────────────────────────────────────────────────────────────────────────

-- ─── New Enums ───────────────────────────────────────────────────────────────

CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIAL', 'COMPLETED', 'CANCELLED');
CREATE TYPE "GRNStatus" AS ENUM ('DRAFT', 'COMPLETED');
CREATE TYPE "WarrantyClaimStatus" AS ENUM (
  'PENDING', 'APPROVED', 'REJECTED', 'SENT_TO_SUPPLIER', 'REPLACED', 'REFUNDED'
);

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE "purchase_orders" (
    "id"          TEXT          NOT NULL,
    "tenant_id"   TEXT          NOT NULL,
    "supplier_id" TEXT          NOT NULL,
    "number"      TEXT          NOT NULL,
    "status"      "POStatus"    NOT NULL DEFAULT 'DRAFT',
    "total"       DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes"       TEXT,
    "created_at"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3)  NOT NULL,
    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_order_items" (
    "id"         TEXT          NOT NULL,
    "tenant_id"  TEXT          NOT NULL,
    "po_id"      TEXT          NOT NULL,
    "product_id" TEXT          NOT NULL,
    "qty"        DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total"      DECIMAL(12,2) NOT NULL,
    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goods_received_notes" (
    "id"         TEXT          NOT NULL,
    "tenant_id"  TEXT          NOT NULL,
    "po_id"      TEXT,
    "number"     TEXT          NOT NULL,
    "status"     "GRNStatus"   NOT NULL DEFAULT 'DRAFT',
    "notes"      TEXT,
    "created_at" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3)  NOT NULL,
    CONSTRAINT "goods_received_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goods_received_note_items" (
    "id"         TEXT          NOT NULL,
    "tenant_id"  TEXT          NOT NULL,
    "grn_id"     TEXT          NOT NULL,
    "product_id" TEXT          NOT NULL,
    "qty"        DECIMAL(12,3) NOT NULL,
    CONSTRAINT "goods_received_note_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "warranty_claims" (
    "id"         TEXT                   NOT NULL,
    "tenant_id"  TEXT                   NOT NULL,
    "invoice_id" UUID,
    "product_id" TEXT                   NOT NULL,
    "serial"     TEXT,
    "issue"      TEXT                   NOT NULL,
    "status"     "WarrantyClaimStatus"  NOT NULL DEFAULT 'PENDING',
    "notes"      TEXT,
    "created_at" TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3)           NOT NULL,
    CONSTRAINT "warranty_claims_pkey" PRIMARY KEY ("id")
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX "idx_purchase_orders_tenant_status" ON "purchase_orders"("tenant_id", "status");
CREATE INDEX "idx_grn_tenant_status" ON "goods_received_notes"("tenant_id", "status");
CREATE INDEX "idx_warranty_claims_tenant_status" ON "warranty_claims"("tenant_id", "status");

-- ─── Foreign Keys ─────────────────────────────────────────────────────────────

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id");

ALTER TABLE "purchase_order_items"
  ADD CONSTRAINT "purchase_order_items_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_order_items"
  ADD CONSTRAINT "purchase_order_items_po_id_fkey"
  FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_order_items"
  ADD CONSTRAINT "purchase_order_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id");

ALTER TABLE "goods_received_notes"
  ADD CONSTRAINT "goods_received_notes_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goods_received_notes"
  ADD CONSTRAINT "goods_received_notes_po_id_fkey"
  FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "goods_received_note_items"
  ADD CONSTRAINT "goods_received_note_items_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goods_received_note_items"
  ADD CONSTRAINT "goods_received_note_items_grn_id_fkey"
  FOREIGN KEY ("grn_id") REFERENCES "goods_received_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goods_received_note_items"
  ADD CONSTRAINT "goods_received_note_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id");

ALTER TABLE "warranty_claims"
  ADD CONSTRAINT "warranty_claims_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "warranty_claims"
  ADD CONSTRAINT "warranty_claims_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "warranty_claims"
  ADD CONSTRAINT "warranty_claims_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id");

-- ─── Row-Level Security (new tables) ──────────────────────────────────────────

ALTER TABLE "purchase_orders"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_order_items"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goods_received_notes"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goods_received_note_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warranty_claims"           ENABLE ROW LEVEL SECURITY;

ALTER TABLE "purchase_orders"           FORCE ROW LEVEL SECURITY;
ALTER TABLE "purchase_order_items"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "goods_received_notes"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "goods_received_note_items" FORCE ROW LEVEL SECURITY;
ALTER TABLE "warranty_claims"           FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "purchase_orders"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY "tenant_isolation" ON "purchase_order_items"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY "tenant_isolation" ON "goods_received_notes"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY "tenant_isolation" ON "goods_received_note_items"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY "tenant_isolation" ON "warranty_claims"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

-- ──────────────────────────────────────────────────────────────────────────────
-- RLS remediation for pre-existing tables
--
-- Audit while writing this migration found two classes of gaps beyond the
-- purchasing/warranty tables above:
--
--  1. 20240106000000_vertical_tables ran ENABLE ROW LEVEL SECURITY but never
--     FORCE ROW LEVEL SECURITY, for: restaurant_tables, kots, imei_records,
--     repair_jobs, rental_agreements, promotions. Without FORCE, RLS policies
--     do not apply to the table owner — and the app's DATABASE_URL role is
--     very likely the table owner (it ran the migrations), so tenant
--     isolation on these 6 tables may have been decorative only.
--
--  2. 20240115000000_restaurant_advanced added restaurant_orders, split_bills,
--     loyalty_accounts, loyalty_transactions, shifts with NO RLS statements
--     at all (not even ENABLE) despite schema.prisma commenting all five as
--     "RLS enabled" — i.e. these 5 tables currently have zero tenant
--     isolation at the DB layer.
--
-- Both are fixed here now that new RLS DDL is already being written.
-- ──────────────────────────────────────────────────────────────────────────────

-- (1) FORCE RLS on the 6 tables that only had ENABLE

ALTER TABLE "restaurant_tables" FORCE ROW LEVEL SECURITY;
ALTER TABLE "kots"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "imei_records"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "repair_jobs"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "rental_agreements" FORCE ROW LEVEL SECURITY;
ALTER TABLE "promotions"        FORCE ROW LEVEL SECURITY;

-- (2) Full RLS (ENABLE + FORCE + policy) on the 5 tables that had none

ALTER TABLE "restaurant_orders"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "split_bills"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "loyalty_accounts"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "loyalty_transactions"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shifts"                ENABLE ROW LEVEL SECURITY;

ALTER TABLE "restaurant_orders"     FORCE ROW LEVEL SECURITY;
ALTER TABLE "split_bills"           FORCE ROW LEVEL SECURITY;
ALTER TABLE "loyalty_accounts"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "loyalty_transactions"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "shifts"                FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "restaurant_orders"
  USING (tenant_id = current_setting('app.current_tenant', true));
CREATE POLICY "tenant_isolation" ON "split_bills"
  USING (tenant_id = current_setting('app.current_tenant', true));
CREATE POLICY "tenant_isolation" ON "loyalty_accounts"
  USING (tenant_id = current_setting('app.current_tenant', true));
CREATE POLICY "tenant_isolation" ON "loyalty_transactions"
  USING (tenant_id = current_setting('app.current_tenant', true));
CREATE POLICY "tenant_isolation" ON "shifts"
  USING (tenant_id = current_setting('app.current_tenant', true));
