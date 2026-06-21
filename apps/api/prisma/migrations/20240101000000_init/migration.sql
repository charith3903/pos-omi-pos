-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE "BusinessType" AS ENUM (
  'SPARE_PARTS', 'RESTAURANT', 'ELECTRICAL',
  'SUPERMARKET', 'TEXTILE', 'MOBILE', 'RENTAL'
);

CREATE TYPE "TenantPlan"   AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED');
CREATE TYPE "UserRole"     AS ENUM ('OWNER', 'MANAGER', 'CASHIER');

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- tenants: no RLS — used to resolve tenant context before queries start
CREATE TABLE "tenants" (
    "id"            TEXT            NOT NULL,
    "name"          TEXT            NOT NULL,
    "subdomain"     TEXT            NOT NULL,
    "business_type" "BusinessType"  NOT NULL,
    "plan"          "TenantPlan"    NOT NULL DEFAULT 'STARTER',
    "status"        "TenantStatus"  NOT NULL DEFAULT 'TRIAL',
    "created_at"    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
    "id"            TEXT         NOT NULL,
    "tenant_id"     TEXT         NOT NULL,
    "name"          TEXT         NOT NULL,
    "email"         TEXT         NOT NULL,
    "phone"         TEXT,
    "password_hash" TEXT         NOT NULL,
    "role"          "UserRole"   NOT NULL DEFAULT 'CASHIER',
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outlets" (
    "id"         TEXT         NOT NULL,
    "tenant_id"  TEXT         NOT NULL,
    "name"       TEXT         NOT NULL,
    "address"    TEXT,
    "is_default" BOOLEAN      NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outlets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "devices" (
    "id"           TEXT         NOT NULL,
    "tenant_id"    TEXT         NOT NULL,
    "outlet_id"    TEXT         NOT NULL,
    "name"         TEXT         NOT NULL,
    "last_sync_at" TIMESTAMP(3),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "tenants_subdomain_key"        ON "tenants"("subdomain");
CREATE UNIQUE INDEX "users_tenant_id_email_key"    ON "users"("tenant_id", "email");

-- ─── Foreign Keys ─────────────────────────────────────────────────────────────

ALTER TABLE "users"
  ADD CONSTRAINT "users_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "outlets"
  ADD CONSTRAINT "outlets_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "devices"
  ADD CONSTRAINT "devices_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "devices"
  ADD CONSTRAINT "devices_outlet_id_fkey"
  FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Row-Level Security ───────────────────────────────────────────────────────
--
-- Design: the NestJS PrismaService.withTenant(tenantId, fn) helper wraps every
-- operation in a transaction and runs:
--   SELECT set_config('app.current_tenant', $tenantId, true)
-- The `true` flag makes the setting LOCAL to the transaction, so it never
-- leaks across pooled connections.
--
-- FORCE ensures the DB owner (Prisma's connection user) is also subject to
-- RLS, giving the same isolation guarantee in production as in tests.
--
-- If app.current_tenant is unset, current_setting(..., true) returns NULL,
-- and NULL = NULL is FALSE in SQL → zero rows visible.  This is the safe
-- default: fail-closed rather than fail-open.

ALTER TABLE "users"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outlets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "devices" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "users"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "outlets" FORCE ROW LEVEL SECURITY;
ALTER TABLE "devices" FORCE ROW LEVEL SECURITY;

-- A single PERMISSIVE policy per table covers SELECT / INSERT / UPDATE / DELETE.
-- For INSERT the USING clause is implicitly also the WITH CHECK clause.
CREATE POLICY tenant_isolation ON "users"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "outlets"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "devices"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
