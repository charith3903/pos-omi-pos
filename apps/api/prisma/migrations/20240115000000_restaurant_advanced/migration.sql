-- Restaurant Advanced: Orders, Splits, Loyalty, Shifts
-- Migration: 20240115000000_restaurant_advanced

-- ── 1. Restaurant Orders ─────────────────────────────────────────────────────
CREATE TABLE "restaurant_orders" (
    "id"                 TEXT         NOT NULL,
    "tenant_id"          TEXT         NOT NULL,
    "table_id"           TEXT,
    "order_number"       TEXT         NOT NULL,
    "status"             TEXT         NOT NULL DEFAULT 'OPEN',
    "order_type"         TEXT         NOT NULL DEFAULT 'DINE_IN',
    "guest_count"        INTEGER      NOT NULL DEFAULT 1,
    "waiter_id"          TEXT,
    "customer_id"        TEXT,
    "is_complementary"   BOOLEAN      NOT NULL DEFAULT false,
    "complementary_note" TEXT,
    "notes"              TEXT,
    "discount"           DECIMAL(12,2) NOT NULL DEFAULT 0,
    "opened_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at"          TIMESTAMP(3),
    "invoice_id"         UUID,
    CONSTRAINT "restaurant_orders_pkey" PRIMARY KEY ("id")
);

-- ── 2. Split Bills ───────────────────────────────────────────────────────────
CREATE TABLE "split_bills" (
    "id"         TEXT         NOT NULL,
    "tenant_id"  TEXT         NOT NULL,
    "order_id"   TEXT         NOT NULL,
    "label"      TEXT         NOT NULL,
    "items"      JSONB        NOT NULL DEFAULT '[]',
    "total"      DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paid"       BOOLEAN      NOT NULL DEFAULT false,
    CONSTRAINT "split_bills_pkey" PRIMARY KEY ("id")
);

-- ── 3. Loyalty Accounts ──────────────────────────────────────────────────────
CREATE TABLE "loyalty_accounts" (
    "id"              TEXT         NOT NULL,
    "tenant_id"       TEXT         NOT NULL,
    "customer_id"     TEXT         NOT NULL,
    "points"          INTEGER      NOT NULL DEFAULT 0,
    "lifetime_points" INTEGER      NOT NULL DEFAULT 0,
    "tier"            TEXT         NOT NULL DEFAULT 'BRONZE',
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id")
);

-- ── 4. Loyalty Transactions ──────────────────────────────────────────────────
CREATE TABLE "loyalty_transactions" (
    "id"           TEXT         NOT NULL,
    "tenant_id"    TEXT         NOT NULL,
    "account_id"   TEXT         NOT NULL,
    "type"         TEXT         NOT NULL,
    "points"       INTEGER      NOT NULL,
    "reference_id" TEXT,
    "notes"        TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- ── 5. Shifts ────────────────────────────────────────────────────────────────
CREATE TABLE "shifts" (
    "id"           TEXT         NOT NULL,
    "tenant_id"    TEXT         NOT NULL,
    "outlet_id"    TEXT,
    "status"       TEXT         NOT NULL DEFAULT 'OPEN',
    "opened_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at"    TIMESTAMP(3),
    "opened_by"    TEXT,
    "closed_by"    TEXT,
    "opening_cash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "closing_cash" DECIMAL(12,2),
    "notes"        TEXT,
    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- ── 6. Extend kots table ─────────────────────────────────────────────────────
ALTER TABLE "kots" ADD COLUMN IF NOT EXISTS "order_id" TEXT;
ALTER TABLE "kots" ADD COLUMN IF NOT EXISTS "portion"   TEXT;
ALTER TABLE "kots" ADD COLUMN IF NOT EXISTS "kot_notes" TEXT;

-- ── 7. Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX "restaurant_orders_tenant_status_idx"  ON "restaurant_orders"("tenant_id", "status");
CREATE INDEX "restaurant_orders_tenant_table_idx"   ON "restaurant_orders"("tenant_id", "table_id");
CREATE UNIQUE INDEX "loyalty_accounts_customer_id_key" ON "loyalty_accounts"("customer_id");
CREATE INDEX "loyalty_accounts_tenant_id_idx"       ON "loyalty_accounts"("tenant_id");
CREATE INDEX "loyalty_transactions_account_id_idx"  ON "loyalty_transactions"("account_id");
CREATE INDEX "shifts_tenant_status_idx"             ON "shifts"("tenant_id", "status");
CREATE INDEX "split_bills_order_id_idx"             ON "split_bills"("order_id");
CREATE INDEX "kots_order_id_idx"                    ON "kots"("order_id");

-- ── 8. Foreign Keys ──────────────────────────────────────────────────────────
ALTER TABLE "restaurant_orders" ADD CONSTRAINT "restaurant_orders_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "restaurant_orders" ADD CONSTRAINT "restaurant_orders_table_id_fkey"
    FOREIGN KEY ("table_id") REFERENCES "restaurant_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kots" ADD CONSTRAINT "kots_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "restaurant_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "split_bills" ADD CONSTRAINT "split_bills_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "split_bills" ADD CONSTRAINT "split_bills_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "restaurant_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shifts" ADD CONSTRAINT "shifts_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
