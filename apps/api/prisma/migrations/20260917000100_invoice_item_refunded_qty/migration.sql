-- Tracks cumulative returned quantity per invoice item, so RefundsService
-- can correctly tell a full return (mark invoice REFUNDED) from a partial
-- one (PARTIAL_REFUND) across possibly more than one return visit.

ALTER TABLE "invoice_items"
  ADD COLUMN "refunded_qty" DECIMAL(12,3) NOT NULL DEFAULT 0;
