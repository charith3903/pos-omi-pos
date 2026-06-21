-- Migration: sync_logs table
-- No RLS — inserted directly by the sync service, never filtered by tenant context.

CREATE TABLE "sync_logs" (
    "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"  TEXT         NOT NULL,
    "device_id"  TEXT         NOT NULL,
    "direction"  TEXT         NOT NULL,
    "item_count" INTEGER      NOT NULL DEFAULT 0,
    "cursor"     TEXT,
    "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sync_logs_tenant_created_idx" ON "sync_logs"("tenant_id", "created_at");
