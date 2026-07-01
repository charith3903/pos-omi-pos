-- KOT / BOT station routing
-- Migration: 20260701000000_kot_bot_station

ALTER TABLE "kots" ADD COLUMN "station" TEXT NOT NULL DEFAULT 'KITCHEN';

CREATE INDEX "kots_tenant_id_station_idx" ON "kots"("tenant_id", "station");
