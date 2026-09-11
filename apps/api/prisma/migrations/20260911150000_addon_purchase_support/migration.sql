-- Rename: SubscriptionAddOn's gateway ref field was named for a Stripe
-- "subscription item" (an add-on to the tenant's main subscription), but the
-- purchase design creates an independent Stripe Subscription per add-on
-- instead, so the field is renamed for clarity. Unused at the time of this
-- migration, so no data migration is needed.
ALTER TABLE "subscription_addons" RENAME COLUMN "stripe_subscription_item_id" TO "stripe_subscription_id";

-- Lets the add-on activation webhook safely upsert by (tenant, module)
-- instead of risking duplicate rows for the same add-on.
CREATE UNIQUE INDEX "subscription_addons_tenant_id_addon_module_id_key" ON "subscription_addons"("tenant_id", "addon_module_id");
