-- ──────────────────────────────────────────────────────────────────────────────
-- Batch-wise GRN/pricing + WhatsApp/SMS notifications
--
-- Each goods_received_note_item row now IS a batch: it carries its own cost,
-- selling price, batch number and expiry, and qty_remaining is decremented as
-- the batch is depleted (FIFO). stock_movements gains an optional batch_id so
-- movements can be traced back to the batch they drew from, plus a unit_cost
-- snapshot for margin/COGS reporting.
--
-- notification_settings / message_logs back the new WhatsApp (Meta Cloud API)
-- and SMS (smsapi.com) integrations.
-- ──────────────────────────────────────────────────────────────────────────────

-- ─── New Enums ───────────────────────────────────────────────────────────────

CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'SMS');
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- ─── goods_received_note_items: batch fields ──────────────────────────────────
-- Added nullable first (existing rows predate batch tracking), backfilled,
-- then tightened to NOT NULL where the model requires it.

ALTER TABLE "goods_received_note_items"
  ADD COLUMN "batch_no"      TEXT,
  ADD COLUMN "expiry_date"   TIMESTAMP(3),
  ADD COLUMN "qty_remaining" DECIMAL(12,3),
  ADD COLUMN "selling_price" DECIMAL(12,2),
  ADD COLUMN "unit_cost"     DECIMAL(12,2),
  ADD COLUMN "variant_id"    TEXT;

UPDATE "goods_received_note_items"
SET "batch_no"      = 'LEGACY-' || "id",
    "qty_remaining" = "qty",
    "unit_cost"     = 0
WHERE "batch_no" IS NULL;

ALTER TABLE "goods_received_note_items"
  ALTER COLUMN "batch_no"      SET NOT NULL,
  ALTER COLUMN "qty_remaining" SET NOT NULL,
  ALTER COLUMN "unit_cost"     SET NOT NULL;

-- ─── stock_movements: batch trace + cost snapshot ─────────────────────────────

ALTER TABLE "stock_movements"
  ADD COLUMN "batch_id"  TEXT,
  ADD COLUMN "unit_cost" DECIMAL(12,2);

-- ─── New tables: notifications ────────────────────────────────────────────────

CREATE TABLE "notification_settings" (
    "id"                            TEXT         NOT NULL,
    "tenant_id"                     TEXT         NOT NULL,
    "whatsapp_enabled"              BOOLEAN      NOT NULL DEFAULT false,
    "whatsapp_phone_number_id"      TEXT,
    "whatsapp_business_account_id"  TEXT,
    "whatsapp_access_token"         TEXT,
    "sms_enabled"                   BOOLEAN      NOT NULL DEFAULT false,
    "sms_api_token"                 TEXT,
    "sms_sender_name"               TEXT,
    "auto_send_receipt_whatsapp"    BOOLEAN      NOT NULL DEFAULT false,
    "auto_send_receipt_sms"         BOOLEAN      NOT NULL DEFAULT false,
    "created_at"                    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "message_logs" (
    "id"                   TEXT           NOT NULL,
    "tenant_id"            TEXT           NOT NULL,
    "channel"              "MessageChannel" NOT NULL,
    "recipient_phone"      TEXT           NOT NULL,
    "body"                 TEXT           NOT NULL,
    "status"               "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "provider_message_id"  TEXT,
    "error_message"        TEXT,
    "related_invoice_id"   UUID,
    "created_at"           TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id")
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "notification_settings_tenant_id_key" ON "notification_settings"("tenant_id");
CREATE INDEX "idx_message_logs_tenant_created" ON "message_logs"("tenant_id", "created_at");
CREATE INDEX "idx_grn_items_tenant_product_variant" ON "goods_received_note_items"("tenant_id", "product_id", "variant_id");

-- ─── Foreign Keys ─────────────────────────────────────────────────────────────

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "goods_received_note_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "goods_received_note_items"
  ADD CONSTRAINT "goods_received_note_items_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notification_settings"
  ADD CONSTRAINT "notification_settings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_logs"
  ADD CONSTRAINT "message_logs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_logs"
  ADD CONSTRAINT "message_logs_related_invoice_id_fkey"
  FOREIGN KEY ("related_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Row-Level Security (new tables) ──────────────────────────────────────────

ALTER TABLE "notification_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_logs"          ENABLE ROW LEVEL SECURITY;

ALTER TABLE "notification_settings" FORCE ROW LEVEL SECURITY;
ALTER TABLE "message_logs"          FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "notification_settings"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY "tenant_isolation" ON "message_logs"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
