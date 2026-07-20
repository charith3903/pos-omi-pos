-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('STRIPE', 'PAYPAL', 'PAYHERE');

-- CreateEnum
CREATE TYPE "BillingTxnStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BillingCurrency" AS ENUM ('USD', 'LKR');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "trial_ends_at" TIMESTAMP(3);

-- CreateTable (no RLS — global catalog, see note at bottom of this file)
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "business_type" "BusinessType" NOT NULL,
    "name" TEXT NOT NULL,
    "price_usd_monthly" DECIMAL(10,2) NOT NULL,
    "price_usd_annual" DECIMAL(10,2),
    "price_lkr_monthly" DECIMAL(10,2),
    "price_lkr_annual" DECIMAL(10,2),
    "trial_days" INTEGER NOT NULL DEFAULT 14,
    "included_modules" TEXT[],
    "stripe_price_id" TEXT,
    "paypal_plan_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable (no RLS — global catalog, see note at bottom of this file)
CREATE TABLE "addon_modules" (
    "id" TEXT NOT NULL,
    "module_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_usd_monthly" DECIMAL(10,2) NOT NULL,
    "price_lkr_monthly" DECIMAL(10,2),
    "applicable_business_types" "BusinessType"[],
    "stripe_price_id" TEXT,
    "paypal_plan_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addon_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "currency" "BillingCurrency" NOT NULL DEFAULT 'USD',
    "gateway" "PaymentGateway",
    "trial_ends_at" TIMESTAMP(3),
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "paypal_subscription_id" TEXT,
    "payhere_merchant_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_addons" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "addon_module_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMP(3),
    "stripe_subscription_item_id" TEXT,
    "paypal_subscription_id" TEXT,

    CONSTRAINT "subscription_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_transactions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "gateway" "PaymentGateway" NOT NULL,
    "gateway_txn_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" "BillingCurrency" NOT NULL,
    "status" "BillingTxnStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_business_type_key" ON "plans"("business_type");

-- CreateIndex
CREATE UNIQUE INDEX "addon_modules_module_key_key" ON "addon_modules"("module_key");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_tenant_id_key" ON "subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_status_idx" ON "subscriptions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "subscription_addons_tenant_id_status_idx" ON "subscription_addons"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_transactions_gateway_txn_id_key" ON "billing_transactions"("gateway_txn_id");

-- CreateIndex
CREATE INDEX "billing_transactions_tenant_id_created_at_idx" ON "billing_transactions"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_addons" ADD CONSTRAINT "subscription_addons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_addons" ADD CONSTRAINT "subscription_addons_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_addons" ADD CONSTRAINT "subscription_addons_addon_module_id_fkey" FOREIGN KEY ("addon_module_id") REFERENCES "addon_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Row-Level Security ───────────────────────────────────────────────────────
-- `plans` and `addon_modules` are global catalogs (like the vertical packs
-- themselves) — every tenant reads the same rows, so no RLS, matching the
-- precedent set by `sync_logs` ("No RLS — inserted by service role").
--
-- `subscriptions`, `subscription_addons`, `billing_transactions` are
-- tenant-scoped and get the same ENABLE + FORCE + tenant_isolation policy as
-- every other tenant table in this schema.

ALTER TABLE "subscriptions"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_addons"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_transactions"  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "subscriptions"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "subscription_addons"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "billing_transactions"  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "subscriptions"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY "tenant_isolation" ON "subscription_addons"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY "tenant_isolation" ON "billing_transactions"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
