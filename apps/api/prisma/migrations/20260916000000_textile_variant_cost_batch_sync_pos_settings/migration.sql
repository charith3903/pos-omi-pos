-- ──────────────────────────────────────────────────────────────────────────────
-- Textile: per-variant cost cache, batch updated_at for incremental sync,
-- variant-level PO planning, and per-outlet POS settings (Modern/Traditional
-- view toggle).
-- ──────────────────────────────────────────────────────────────────────────────

-- ─── New Enum ────────────────────────────────────────────────────────────────

CREATE TYPE "PosViewMode" AS ENUM ('MODERN', 'TRADITIONAL');

-- ─── product_variants: persisted "current cost" cache ─────────────────────────
-- Mirrors the existing nullable `price` override — null = inherit from
-- product. Pushed from the newest GRN batch's unitCost (see PurchasingService).

ALTER TABLE "product_variants"
  ADD COLUMN "cost" DECIMAL(12,2);

-- ─── goods_received_note_items: updated_at for incremental sync ──────────────
-- Needed so SyncService.pull() can detect batches whose qty_remaining changed
-- since a device's last sync. DEFAULT CURRENT_TIMESTAMP backfills existing
-- rows in the same statement.

ALTER TABLE "goods_received_note_items"
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ─── purchase_order_items: variant-level PO planning ──────────────────────────
-- GRN already receives per-variant; POs could not plan per-variant until now.

ALTER TABLE "purchase_order_items"
  ADD COLUMN "variant_id" TEXT;

ALTER TABLE "purchase_order_items"
  ADD CONSTRAINT "purchase_order_items_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── New table: outlet_settings ────────────────────────────────────────────────
-- One row per outlet — currently just the POS view-mode toggle
-- (Modern/Traditional), following the notification_settings pattern.

CREATE TABLE "outlet_settings" (
    "id"            TEXT          NOT NULL,
    "tenant_id"     TEXT          NOT NULL,
    "outlet_id"     TEXT          NOT NULL,
    "pos_view_mode" "PosViewMode" NOT NULL DEFAULT 'TRADITIONAL',
    "created_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3)  NOT NULL,
    CONSTRAINT "outlet_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outlet_settings_outlet_id_key" ON "outlet_settings"("outlet_id");

ALTER TABLE "outlet_settings"
  ADD CONSTRAINT "outlet_settings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "outlet_settings"
  ADD CONSTRAINT "outlet_settings_outlet_id_fkey"
  FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Row-Level Security (new table) ────────────────────────────────────────────

ALTER TABLE "outlet_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outlet_settings" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "outlet_settings"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
